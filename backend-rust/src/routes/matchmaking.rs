//! Matchmaking WebSocket handler

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;

use tokio::sync::mpsc;
use axum::{Json, routing::{get, post}};

/// Create matchmaking router
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/status", get(get_status))
        .route("/join", post(join_matchmaking))
        .route("/leave/:player_id", post(leave_matchmaking))
        .route("/queue-stats", get(get_queue_stats))
        .route("/ws/:player_id", get(ws_handler))
}


/// Join matchmaking request
#[derive(Debug, Deserialize)]
struct JoinRequest {
    player_name: String,
    city: String,
}

/// Join matchmaking via REST (pre-verification)
async fn join_matchmaking(
    State(_state): State<AppState>,
    Json(req): Json<JoinRequest>,
) -> Json<serde_json::Value> {
    let player_id = Uuid::new_v4();
    
    // City config defaults
    let (entry_cost, prize_pool, turn_timer) = match req.city.to_lowercase().as_str() {
        "dubai" => (50, 950, 30),
        "cairo" => (100, 1900, 25),
        "oslo" => (200, 3800, 20),
        _ => (50, 950, 30),
    };
    
    Json(serde_json::json!({
        "success": true,
        "message": "Use WebSocket endpoint for real-time matchmaking",
        "data": {
            "city": req.city,
            "player_name": req.player_name,
            "websocket_endpoint": format!("/matchmaking/ws/{}", player_id),
            "entry_cost": entry_cost,
            "prize_pool": prize_pool,
            "turn_timer": turn_timer
        }
    }))
}

/// Leave matchmaking queue
async fn leave_matchmaking(
    State(state): State<AppState>,
    Path(player_id): Path<Uuid>,
) -> Json<serde_json::Value> {
    state.matchmaking_queue.leave(player_id).await;
    Json(serde_json::json!({
        "success": true,
        "message": "Left matchmaking queue"
    }))
}

/// Get queue statistics per city
async fn get_queue_stats(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let stats = state.matchmaking_queue.get_stats().await;
    let mut city_stats = std::collections::HashMap::new();
    
    for (city, count) in stats {
        city_stats.insert(city, serde_json::json!({
            "players_waiting": count,
            "city_config": {}
        }));
    }
    
    Json(serde_json::json!({
        "success": true,
        "message": "Queue stats retrieved",
        "data": city_stats
    }))
}


/// Get matchmaking status
async fn get_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    let stats = state.matchmaking_queue.get_stats().await;
    let total_waiting: usize = stats.iter().map(|(_, count)| count).sum();
    
    Json(serde_json::json!({
        "success": true,
        "queue_size": total_waiting,
        "cities": stats
    }))
}

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(player_id): Path<Uuid>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state, player_id))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, state: AppState, player_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();
    
    // Create a channel for outgoing messages
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    tracing::info!("Player {} connected via WebSocket", player_id);

    // Register connection
    state.connection_manager.connect(player_id, tx.clone()).await;

    // Send welcome message
    let welcome = serde_json::json!({
        "type": "connected",
        "player_id": player_id,
        "message": "Connected to PCD matchmaking server"
    });
    
    let _ = tx.send(Message::Text(welcome.to_string()));

    // Spawn a task to handle outgoing messages from the channel
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Message handling loop (incoming)
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Err(e) = handle_message(&state, player_id, &text).await {
                    tracing::error!("Error handling message: {}", e);
                    let error = serde_json::json!({
                        "type": "error",
                        "message": e.to_string()
                    });
                    let _ = tx.send(Message::Text(error.to_string()));
                }
            }
            Ok(Message::Ping(data)) => {
                let _ = tx.send(Message::Pong(data));
            }
            Ok(Message::Close(_)) => break,
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup on disconnect
    send_task.abort();
    let city = state.matchmaking_queue.leave(player_id).await;
    state.connection_manager.disconnect(player_id).await;

    // If they were in a queue, notify others in that city
    if let Some(city_name) = city {
        broadcast_city_stats(state, &city_name).await;
    }
    
    tracing::info!("Player {} disconnected", player_id);
}

/// Broadcast queue and online stats to everyone in a city
async fn broadcast_city_stats(state: AppState, city: &str) {
    let (waiting, entry_fee, prize) = state.matchmaking_queue.get_city_stats(city).await;
    let online = state.connection_manager.get_online_count(city);
    
    let stats = serde_json::json!({
        "type": "city_stats_update",
        "city": city,
        "players_online": online,
        "players_waiting": waiting,
        "entry_fee": entry_fee,
        "prize_pool": prize
    });
    
    state.connection_manager.broadcast_to_city(city, Message::Text(stats.to_string()));
}

/// Handle incoming WebSocket message
async fn handle_message(
    state: &AppState,
    player_id: Uuid,
    text: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let msg: serde_json::Value = serde_json::from_str(text)?;
    let msg_type = msg["type"].as_str().unwrap_or("");

    match msg_type {
        "ping" => {
            let pong = serde_json::json!({"type": "pong"});
            state.connection_manager.send_message(&player_id, Message::Text(pong.to_string()));
        }
        "select_city" => {
            let city = msg["city"].as_str().unwrap_or("dubai");
            state.connection_manager.set_location(player_id, city.to_string());
            
            // Send initial stats for the selected city
            let (waiting, entry_fee, prize) = state.matchmaking_queue.get_city_stats(city).await;
            let online = state.connection_manager.get_online_count(city);
            
            let response = serde_json::json!({
                "type": "city_joined",
                "city": city,
                "players_online": online,
                "players_waiting": waiting,
                "entry_fee": entry_fee,
                "prize_pool": prize
            });
            state.connection_manager.send_message(&player_id, Message::Text(response.to_string()));
            
            // Broadcast update to others in the city
            broadcast_city_stats(state.clone(), city).await;
        }
        "join_queue" => {
            let city = msg["city"].as_str().unwrap_or("dubai");
            let player_name = msg["player_name"].as_str().unwrap_or("Anonymous");
            
            tracing::info!("Player {} joining {} queue", player_name, city);
            
            if state.matchmaking_queue.join(player_id, player_name.to_string(), city.to_string()).await? {
                let response = serde_json::json!({
                    "type": "queue_joined",
                    "city": city,
                    "message": "Added to matchmaking queue"
                });
                state.connection_manager.send_message(&player_id, Message::Text(response.to_string()));
                
                // Broadcast updated stats
                broadcast_city_stats(state.clone(), city).await;
            }
        }
        "leave_queue" => {
            if let Some(city) = state.matchmaking_queue.leave(player_id).await {
                let response = serde_json::json!({
                    "type": "queue_left",
                    "message": "Removed from queue"
                });
                state.connection_manager.send_message(&player_id, Message::Text(response.to_string()));
                
                // Broadcast updated stats
                broadcast_city_stats(state.clone(), &city).await;
            }
        }
        "match_poison" => {
            let game_id = msg["target_id"].as_str()
                .and_then(|s| Uuid::parse_str(s).ok());
            let candy = msg["candy"].as_str().unwrap_or("");

            if let Some(game_id) = game_id {
                match state.game_engine.set_poison_choice(game_id, player_id, candy).await {
                    Ok(started) => {
                        let game = state.game_engine.get_game(game_id).unwrap();
                        let p1_id = game.player1.id;
                        let p2_id = game.player2.id;

                        // Notify sender
                        let response = serde_json::json!({
                            "type": "poison_set",
                            "game_started": started
                        });
                        state.connection_manager.send_message(&player_id, Message::Text(response.to_string()));

                        // If game started, notify both players with initial state
                        if started {
                            let game_state = serde_json::json!({
                                "type": "game_started",
                                "game_id": game_id,
                                "game_state": game
                            });
                            state.connection_manager.broadcast(&[p1_id, p2_id], Message::Text(game_state.to_string()));
                        }
                    }
                    Err(e) => {
                        let response = serde_json::json!({
                            "type": "error",
                            "message": e.to_string()
                        });
                        state.connection_manager.send_message(&player_id, Message::Text(response.to_string()));
                    }
                }
            }
        }
        "match_move" => {
            let game_id = msg["target_id"].as_str()
                .and_then(|s| Uuid::parse_str(s).ok());
            let candy = msg["candy"].as_str()
                .or_else(|| msg["move"].as_str())
                .unwrap_or("");

            if let Some(game_id) = game_id {
                match state.game_engine.make_move(game_id, player_id, candy).await {
                    Ok(result) => {
                        let game = state.game_engine.get_game(game_id).unwrap();
                        let p1_id = game.player1.id;
                        let p2_id = game.player2.id;

                        // Broadcast move result and new state to both players
                        let response = serde_json::json!({
                            "type": "move_result",
                            "data": result,
                            "game_state": game
                        });
                        state.connection_manager.broadcast(&[p1_id, p2_id], Message::Text(response.to_string()));

                        // 4. If game over, process victory reward or draw refund
                        if result.game_over {
                            let prize = game.prize;
                            let fee = game.entry_fee;

                            if result.result == crate::game::GameResult::Draw {
                                // Draw refund
                                if fee > 0 {
                                    let ref1 = format!("{}_{}_draw_refund", game_id, p1_id);
                                    let ref2 = format!("{}_{}_draw_refund", game_id, p2_id);
                                    let _ = state.db.execute_transaction(&p1_id, fee, "draw_refund", Some(game_id), Some(ref1)).await;
                                    let _ = state.db.execute_transaction(&p2_id, fee, "draw_refund", Some(game_id), Some(ref2)).await;
                                }
                            } else if prize > 0 {
                                if let Some(winner_name) = result.winner.as_deref() {
                                    let winner_id = if winner_name == game.player1.name { Some(game.player1.id) }
                                                   else if winner_name == game.player2.name { Some(game.player2.id) }
                                                   else { None };
                                    
                                    if let Some(w_id) = winner_id {
                                        let ref_id = format!("{}_{}_victory", game_id, w_id);
                                        let _ = state.db.execute_transaction(&w_id, prize, "victory_reward", Some(game_id), Some(ref_id)).await;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        let response = serde_json::json!({
                            "type": "error",
                            "message": e.to_string()
                        });
                        state.connection_manager.send_message(&player_id, Message::Text(response.to_string()));
                    }
                }
            }
        }
        _ => {
            tracing::warn!("Unknown message type: {}", msg_type);
        }
    }

    Ok(())
}
