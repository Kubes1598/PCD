//! Unit tests for game engine

#[cfg(test)]
mod tests {
    use pcd_backend::game::{GameEngine, GameResult, GameState};

    #[tokio::test]
    async fn test_create_game() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        let game = engine.get_game(game_id).unwrap();
        assert_eq!(game.state, GameState::PoisonSelection);
        assert_eq!(game.player1.name, "Player1");
        assert_eq!(game.player2.name, "Player2");
        assert_eq!(game.player1.owned_candies.len(), 12);
        assert_eq!(game.player2.owned_candies.len(), 12);
    }

    #[tokio::test]
    async fn test_set_poison() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        let game = engine.get_game(game_id).unwrap();
        let p1_id = game.player1.id;
        let p2_id = game.player2.id;
        
        let p1_candy = game.player1.owned_candies.iter().next().unwrap().clone();
        let p2_candy = game.player2.owned_candies.iter().next().unwrap().clone();

        // Player 1 sets poison
        let result = engine.set_poison_choice(game_id, p1_id, &p1_candy).await.unwrap();
        assert!(!result); // Game not started yet

        // Player 2 sets poison
        let result = engine.set_poison_choice(game_id, p2_id, &p2_candy).await.unwrap();
        assert!(result); // Game started

        let game = engine.get_game(game_id).unwrap();
        assert_eq!(game.state, GameState::Playing);
    }

    #[tokio::test]
    async fn test_invalid_poison_choice() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        let game = engine.get_game(game_id).unwrap();
        let p1_id = game.player1.id;

        // Try to set candy NOT owned by p1
        let p2_candy = game.player2.owned_candies.iter().next().unwrap().clone();
        let result = engine.set_poison_choice(game_id, p1_id, &p2_candy).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_make_move() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        let game = engine.get_game(game_id).unwrap();
        let p1_id = game.player1.id;
        let p2_id = game.player2.id;
        let p1_candy = game.player1.owned_candies.iter().next().unwrap().clone();
        let p2_candy = game.player2.owned_candies.iter().next().unwrap().clone();

        // Set poisons
        let _ = engine.set_poison_choice(game_id, p1_id, &p1_candy).await.unwrap();
        let _ = engine.set_poison_choice(game_id, p2_id, &p2_candy).await.unwrap();

        // Player 1 picks from Player 2's pool (not the poison)
        let pick = game.player2.owned_candies.iter().find(|&c| c != &p2_candy).unwrap().clone();
        let result = engine.make_move(game_id, p1_id, &pick).await.unwrap();
        assert!(result.success);
        assert!(!result.is_poison);
        assert!(!result.game_over);

        let game = engine.get_game(game_id).unwrap();
        assert_eq!(game.player1.collected_candies.len(), 1);
        assert!(game.player1.collected_candies.contains(&pick));
    }

    #[tokio::test]
    async fn test_pick_poison_loses() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        let game = engine.get_game(game_id).unwrap();
        let p1_id = game.player1.id;
        let p2_id = game.player2.id;
        let p1_candy = game.player1.owned_candies.iter().next().unwrap().clone();
        let p2_candy = game.player2.owned_candies.iter().next().unwrap().clone();

        // Set poisons
        let _ = engine.set_poison_choice(game_id, p1_id, &p1_candy).await.unwrap();
        let _ = engine.set_poison_choice(game_id, p2_id, &p2_candy).await.unwrap();

        // Player 1 picks the poison
        let result = engine.make_move(game_id, p1_id, &p2_candy).await.unwrap();
        assert!(result.is_poison);
        assert!(result.game_over);
        assert_eq!(result.result, GameResult::Player2Win);
    }

    #[tokio::test]
    async fn test_timeout_logic() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        let game = engine.get_game(game_id).unwrap();
        let p1_id = game.player1.id;

        // 1. Both idle in setup -> Cancel
        let result = engine.handle_timeout(game_id, p1_id).unwrap();
        assert!(result.game_over);
        assert_eq!(result.result, GameResult::Ongoing); // Cancelled marker
        assert!(result.loser.is_none());

        // New game to test forfeit
        let game_id = engine.create_game("P1".to_string(), "P2".to_string(), None, None).await;
        let game = engine.get_game(game_id).unwrap();
        let (p1_id, p2_id) = (game.player1.id, game.player2.id);
        let p2_candy = game.player2.owned_candies.iter().next().unwrap().clone();

        let _ = engine.set_poison_choice(game_id, p2_id, &p2_candy).await.unwrap();
        
        // P2 is ready, P1 times out -> Forfeit
        let result = engine.handle_timeout(game_id, p1_id).unwrap();
        assert!(result.game_over);
        assert_eq!(result.result, GameResult::Player2Win);
        assert_eq!(result.loser.unwrap().to_string(), "P1");
    }

    #[tokio::test]
    async fn test_win_by_threshold() {
        let engine = GameEngine::new();
        let game_id = engine.create_game("P1".into(), "P2".into(), None, None).await;
        let game = engine.get_game(game_id).unwrap();
        let (p1_id, p2_id) = (game.player1.id, game.player2.id);
        
        let p1_poison = game.player1.owned_candies.iter().next().unwrap().clone();
        let p2_poison = game.player2.owned_candies.iter().next().unwrap().clone();
        
        // Set poisons
        let _ = engine.set_poison_choice(game_id, p1_id, &p1_poison).await.unwrap();
        let _ = engine.set_poison_choice(game_id, p2_id, &p2_poison).await.unwrap();

        let game = engine.get_game(game_id).unwrap();
        let p2_candies: Vec<String> = game.player2.owned_candies.iter()
            .filter(|&c| c != &p2_poison)
            .cloned().collect();
        let p1_candies: Vec<String> = game.player1.owned_candies.iter()
            .filter(|&c| c != &p1_poison)
            .cloned().collect();

        // P1 collects 11 candies (takes 11 turns for P1 and 10 for P2)
        for i in 0..10 {
            let _ = engine.make_move(game_id, p1_id, &p2_candies[i]).await.unwrap();
            let _ = engine.make_move(game_id, p2_id, &p1_candies[i]).await.unwrap();
        }

        // P1 picks 11th candy
        let result = engine.make_move(game_id, p1_id, &p2_candies[10]).await.unwrap();
        assert!(!result.game_over); // Should NOT be over yet because P2 can still reach 11
        
        // P2 picks their 11th candy
        let result = engine.make_move(game_id, p2_id, &p1_candies[10]).await.unwrap();
        assert!(result.game_over);
        assert_eq!(result.result, GameResult::Draw); // Both reached 11
    }

    #[tokio::test]
    async fn test_wrong_turn() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        let game = engine.get_game(game_id).unwrap();
        let p1_id = game.player1.id;
        let p2_id = game.player2.id;
        let p1_candy = game.player1.owned_candies.iter().next().unwrap().clone();
        let p2_candy = game.player2.owned_candies.iter().next().unwrap().clone();

        // Set poisons
        let _ = engine.set_poison_choice(game_id, p1_id, &p1_candy).await.unwrap();
        let _ = engine.set_poison_choice(game_id, p2_id, &p2_candy).await.unwrap();

        // Player 2 tries to move when it's Player 1's turn
        let pick = game.player1.owned_candies.iter().find(|&c| c != &p1_candy).unwrap().clone();
        let result = engine.make_move(game_id, p2_id, &pick).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_game_not_found() {
        let engine = GameEngine::new();
        let fake_id = uuid::Uuid::new_v4();

        let result = engine.get_game(fake_id);
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_remove_game() {
        let engine = GameEngine::new();
        let game_id = engine.create_game(
            "Player1".to_string(),
            "Player2".to_string(),
            None,
            None,
        ).await;

        assert!(engine.get_game(game_id).is_some());
        
        let removed = engine.remove_game(game_id);
        assert!(removed.is_some());
        
        assert!(engine.get_game(game_id).is_none());
    }
}
