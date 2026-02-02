//! Integration tests for API endpoints

use reqwest::Client;
use serde_json::json;

const BASE_URL: &str = "http://localhost:8000";

#[tokio::test]
#[ignore] // Run with: cargo test --test '*' -- --ignored
async fn test_health_check() {
    let client = Client::new();
    let response = client
        .get(format!("{}/health", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());

    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["status"], "healthy");
}

#[tokio::test]
#[ignore]
async fn test_register_and_login() {
    let client = Client::new();
    let unique_id = uuid::Uuid::new_v4().to_string();

    // Register
    let register_response = client
        .post(format!("{}/auth/register", BASE_URL))
        .json(&json!({
            "email": format!("test_{}@example.com", unique_id),
            "password": "TestPassword123",
            "username": format!("user_{}", &unique_id[..8])
        }))
        .send()
        .await
        .expect("Failed to register");

    assert!(register_response.status().is_success());

    let register_body: serde_json::Value = register_response.json().await.unwrap();
    assert!(register_body["success"].as_bool().unwrap_or(false));
    assert!(register_body["token"].is_string());

    // Login
    let login_response = client
        .post(format!("{}/auth/login", BASE_URL))
        .json(&json!({
            "email": format!("test_{}@example.com", unique_id),
            "password": "TestPassword123"
        }))
        .send()
        .await
        .expect("Failed to login");

    assert!(login_response.status().is_success());

    let login_body: serde_json::Value = login_response.json().await.unwrap();
    assert!(login_body["success"].as_bool().unwrap_or(false));
}

#[tokio::test]
#[ignore]
async fn test_create_game() {
    let client = Client::new();

    let response = client
        .post(format!("{}/games", BASE_URL))
        .json(&json!({
            "player1_name": "TestPlayer1",
            "player2_name": "TestPlayer2"
        }))
        .send()
        .await
        .expect("Failed to create game");

    assert!(response.status().is_success());

    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body["success"].as_bool().unwrap_or(false));
    assert!(body["data"]["game_id"].is_string());
}

#[tokio::test]
#[ignore]
async fn test_get_leaderboard() {
    let client = Client::new();

    let response = client
        .get(format!("{}/users/leaderboard", BASE_URL))
        .send()
        .await
        .expect("Failed to get leaderboard");

    assert!(response.status().is_success());

    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body["players"].is_array());
}

#[tokio::test]
#[ignore]
async fn test_ai_move() {
    let client = Client::new();

    let response = client
        .post(format!("{}/ai/move", BASE_URL))
        .json(&json!({
            "player_candies": ["red", "blue", "green", "yellow"],
            "opponent_collection": [],
            "player_poison": "red",
            "difficulty": "medium"
        }))
        .send()
        .await
        .expect("Failed to get AI move");

    assert!(response.status().is_success());

    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body["success"].as_bool().unwrap_or(false));
    assert!(body["selected_candy"].is_string());
    // AI should not pick the poison
    assert_ne!(body["selected_candy"], "red");
}

#[tokio::test]
#[ignore]
async fn test_game_flow() {
    let client = Client::new();

    // Create game
    let create_response = client
        .post(format!("{}/games", BASE_URL))
        .json(&json!({
            "player1_name": "Alice",
            "player2_name": "Bob"
        }))
        .send()
        .await
        .unwrap();

    let create_body: serde_json::Value = create_response.json().await.unwrap();
    let game_id = create_body["data"]["game_id"].as_str().unwrap();
    let p1_id = create_body["data"]["player1_id"].as_str().unwrap();
    let p2_id = create_body["data"]["player2_id"].as_str().unwrap();

    // Set poisons
    let poison1_response = client
        .post(format!("{}/games/{}/poison", BASE_URL, game_id))
        .json(&json!({
            "player_id": p1_id,
            "poison_candy": "red"
        }))
        .send()
        .await
        .unwrap();
    assert!(poison1_response.status().is_success());

    let poison2_response = client
        .post(format!("{}/games/{}/poison", BASE_URL, game_id))
        .json(&json!({
            "player_id": p2_id,
            "poison_candy": "blue"
        }))
        .send()
        .await
        .unwrap();
    assert!(poison2_response.status().is_success());

    // Make a move
    let move_response = client
        .post(format!("{}/games/{}/move", BASE_URL, game_id))
        .json(&json!({
            "player_id": p1_id,
            "candy_choice": "green"
        }))
        .send()
        .await
        .unwrap();
    assert!(move_response.status().is_success());

    let move_body: serde_json::Value = move_response.json().await.unwrap();
    assert!(move_body["success"].as_bool().unwrap_or(false));

    // Get game state
    let state_response = client
        .get(format!("{}/games/{}", BASE_URL, game_id))
        .send()
        .await
        .unwrap();
    assert!(state_response.status().is_success());
}
