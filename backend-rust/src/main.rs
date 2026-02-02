//! PCD Backend - Poisoned Candy Duel Server
//!
//! High-performance Rust backend for the Poisoned Candy Duel game.

use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use pcd_backend::{
    config::Config,
    db::{Database, RedisClient},
    game, ws, AppState, create_app, shutdown_signal,
};

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "pcd_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env().expect("Failed to load configuration");

    tracing::info!("🚀 Starting PCD Backend v{}", env!("CARGO_PKG_VERSION"));

    // Initialize database
    let db = Database::connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("✅ Database connected");

    // Initialize Redis (optional)
    let redis = if let Some(url) = config.redis_url.as_deref() {
        match RedisClient::connect(url).await {
            Ok(client) => {
                tracing::info!("✅ Redis connected");
                Some(client)
            }
            Err(e) => {
                tracing::warn!("⚠️ Failed to connect to Redis: {}", e);
                None
            }
        }
    } else {
        None
    };

    // Initialize game engine and managers
    let game_engine = game::GameEngine::new();
    let connection_manager = ws::ConnectionManager::new();
    let matchmaking_queue = Arc::new(ws::CityMatchmakingQueue::new(game_engine.clone()));
    let mut timer_manager_inner = ws::GameTimerManager::new(Arc::new(game_engine.clone()));
    timer_manager_inner.set_connection_manager(connection_manager.clone());
    timer_manager_inner.set_db(db.clone());
    let timer_manager = Arc::new(timer_manager_inner);
    
    // Link manager and DB back to engine
    game_engine.set_timer_manager(timer_manager.clone()).await;
    game_engine.set_db(db.clone()).await;

    // Create application state
    let state = AppState {
        db,
        redis,
        config: config.clone(),
        game_engine: game_engine.clone(),
        connection_manager: connection_manager.clone(),
        matchmaking_queue: matchmaking_queue.clone(),
        timer_manager: timer_manager,
    };

    // Spawn matchmaking worker
    let mm_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));
        loop {
            interval.tick().await;
            
            // Check each city for potential matches
            let stats = mm_state.matchmaking_queue.get_stats().await;
            for (city, count) in stats {
                if count >= 2 {
                        if let Some((p1, p2, game_id)) = mm_state.matchmaking_queue.try_match(&city).await {
                            let (waiting, fee, prize) = mm_state.matchmaking_queue.get_city_stats(&city).await;
                            
                            // 1. Deduct entry fees atomically for both players
                            if let Err(e) = mm_state.db.execute_matchmaking_entry(&p1.id, &p2.id, fee, game_id).await {
                                tracing::error!("Payment failed for match! {:?}", e);
                                // If payment fails (e.g. insufficient funds), we should probably notify the players and abort.
                                // But for now, we just skip this match to keep the loop robust.
                                continue;
                            }

                            // 2. Set stakes in game engine
                            mm_state.game_engine.set_stakes(game_id, fee, prize);

                            let game = mm_state.game_engine.get_game(game_id).unwrap();
                            
                            // 3. Notify players of the match
                            let msg_p1 = serde_json::json!({
                                "type": "match_found",
                                "game_id": game_id,
                                "your_role": "player1",
                                "opponent": { "id": p2.id, "name": p2.name },
                                "game_state": game,
                                "city": city
                            });
                            let msg_p2 = serde_json::json!({
                                "type": "match_found",
                                "game_id": game_id,
                                "your_role": "player2",
                                "opponent": { "id": p1.id, "name": p1.name },
                                "game_state": game,
                                "city": city
                            });

                            mm_state.connection_manager.send_message(&p1.id, axum::extract::ws::Message::Text(msg_p1.to_string()));
                            mm_state.connection_manager.send_message(&p2.id, axum::extract::ws::Message::Text(msg_p2.to_string()));

                        // Broadcast new queue size to everyone remaining in/viewing the city
                        let (waiting, fee, prize) = mm_state.matchmaking_queue.get_city_stats(&city).await;
                        let online = mm_state.connection_manager.get_online_count(&city);
                        let update = serde_json::json!({
                            "type": "city_stats_update",
                            "city": city,
                            "players_online": online,
                            "players_waiting": waiting,
                            "entry_fee": fee,
                            "prize_pool": prize
                        });
                        mm_state.connection_manager.broadcast_to_city(&city, axum::extract::ws::Message::Text(update.to_string()));
                    }
                }
            }
        }
    });

    // Build router
    let app = create_app(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("🎮 Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}
