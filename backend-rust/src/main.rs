//! PCD Backend - Poisoned Candy Duel Server
//!
//! High-performance Rust backend for the Poisoned Candy Duel game.

use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use pcd_backend::{
    config::Config,
    create_app,
    db::{Database, RedisClient},
    game, shutdown_signal, ws, AppState,
};

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "pcd_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env().expect("Failed to load configuration");

    tracing::info!("🚀 Starting PCD Backend v{}", env!("CARGO_PKG_VERSION"));

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

    // Initialize Database
    let db = Database::connect(&config.database_url, redis.clone())
        .await
        .expect("Failed to connect to database");

    tracing::info!("✅ Database connected");

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
        timer_manager,
    };

    // Spawn distributed matchmaking workers (one per city)
    let cities = vec!["dubai".to_string(), "cairo".to_string(), "oslo".to_string()];
    for city in cities {
        let mm_state = state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));
            tracing::info!("Started matchmaking worker for city: {}", city);

            loop {
                interval.tick().await;

                // Try to match players in this city
                while let Some((p1, p2, game_id)) = mm_state.matchmaking_queue.try_match(&city).await {
                    let (_waiting, fee, prize) = mm_state.matchmaking_queue.get_city_stats(&city).await;

                    // 1. Create Game State locally first to generate payload
                    mm_state.game_engine.set_stakes(game_id, fee, prize);
                    let game = mm_state.game_engine.get_game(game_id).unwrap();

                    let game_p1 = game.for_viewer(p1.id);
                    let msg_p1 = serde_json::json!({
                        "type": "match_found",
                        "game_id": game_id,
                        "your_role": "player1",
                        "opponent": { "id": p2.id, "name": p2.name },
                        "game_state": game_p1,
                        "city": city,
                        "poison_timer_secs": game.poison_timer_secs,
                        "turn_timer_secs": game.turn_timer_secs
                    });

                    let game_p2 = game.for_viewer(p2.id);
                    let msg_p2 = serde_json::json!({
                        "type": "match_found",
                        "game_id": game_id,
                        "your_role": "player2",
                        "opponent": { "id": p1.id, "name": p1.name },
                        "game_state": game_p2,
                        "city": city,
                        "poison_timer_secs": game.poison_timer_secs,
                        "turn_timer_secs": game.turn_timer_secs
                    });

                    // 2. ATOMIC TRANSACTION: Deduct fees, Create Match, and Queue Outbox Events
                    let outbox_payload = serde_json::json!({
                        "match_id": game_id,
                        "notifications": [
                            { "player_id": p1.id, "message": msg_p1 },
                            { "player_id": p2.id, "message": msg_p2 }
                        ]
                    });

                    if let Err(e) = mm_state
                        .db
                        .create_match_with_outbox(game_id, &p1.id, &p2.id, &city, fee, outbox_payload)
                        .await
                    {
                        tracing::error!("Atomic Match Creation FAILED for city {}! {:?}", city, e);

                        // Notify players of failure immediately
                        let failure_msg = serde_json::json!({
                            "type": "match_error",
                            "message": "Match aborted: payment failed or system error."
                        });
                        
                        mm_state.connection_manager.send_message(
                            &p1.id,
                            axum::extract::ws::Message::Text(failure_msg.to_string()),
                        );
                        mm_state.connection_manager.send_message(
                            &p2.id,
                            axum::extract::ws::Message::Text(failure_msg.to_string()),
                        );

                        // Clean up game from engine
                        mm_state.game_engine.remove_game(game_id);
                        continue;
                    }

                    // Broadcast new queue size (stats update is non-critical/best-effort)
                    let (waiting, fee, prize) =
                        mm_state.matchmaking_queue.get_city_stats(&city).await;
                    let online = mm_state.connection_manager.get_online_count(&city);
                    let update = serde_json::json!({
                        "type": "city_stats_update",
                        "city": city,
                        "players_online": online,
                        "players_waiting": waiting,
                        "entry_fee": fee,
                        "prize_pool": prize
                    });
                    mm_state.connection_manager.broadcast_to_city(
                        &city,
                        axum::extract::ws::Message::Text(update.to_string()),
                    );
                }
            }
        });
    }

    // Spawn Transactional Outbox Dispatcher
    let outbox_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
        loop {
            interval.tick().await;
            
            if let Ok(events) = outbox_state.db.get_pending_outbox(10i64).await {
                for event in events {
                    if event.event_type == "MATCH_FOUND" {
                        // Extract notifications from payload
                        if let Some(notifications) = event.payload["notifications"].as_array() {
                            for notification in notifications {
                                if let (Some(pid_str), Some(msg)) = (
                                    notification["player_id"].as_str(),
                                    notification.get("message")
                                ) {
                                    if let Ok(pid) = uuid::Uuid::parse_str(pid_str) {
                                        outbox_state.connection_manager.send_message(
                                            &pid,
                                            axum::extract::ws::Message::Text(msg.to_string())
                                        );
                                    }
                                }
                            }
                        }
                    }
                    
                    let _ = outbox_state.db.mark_outbox_sent(event.id).await;
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
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .unwrap();
}
