"""
Poisoned Candy Duel Game Engine

Corrected Game Mechanics (Version A):
- Each player has 12 different colored candies
- Players pick poison from their OWN candy pool
- Players can only pick from OPPONENT'S candy pool  
- Win by collecting 11 different colors from opponent's pool
- If both players collect all 11 (avoiding poison) = DRAW
- Player who picks opponent's poison LOSES (dies)
"""

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Any


class GameState(Enum):
    """Enumeration of possible game states."""
    SETUP = "setup"
    POISON_SELECTION = "poison_selection"
    PLAYING = "playing"
    FINISHED = "finished"


class GameResult(Enum):
    """Enumeration of possible game results."""
    PLAYER1_WIN = "player1_win"
    PLAYER2_WIN = "player2_win"
    DRAW = "draw"
    ONGOING = "ongoing"


@dataclass
class Player:
    """Represents a player in the game."""
    id: str
    name: str
    # Candies this player OWNS (can set poison from these)
    owned_candies: Set[str] = field(default_factory=set)
    # Candies this player has COLLECTED from opponent
    collected_candies: List[str] = field(default_factory=list)
    # Poison choice from their own candy pool
    poison_choice: Optional[str] = None


@dataclass
class GameSession:
    """Represents a complete game session between two players."""
    id: str
    player1: Player
    player2: Player
    state: GameState = GameState.SETUP
    current_turn: int = 1
    result: GameResult = GameResult.ONGOING
    created_at: float = field(default_factory=time.time)
    last_updated: float = field(default_factory=time.time)


class PoisonedCandyDuel:
    """Main game engine for managing Poisoned Candy Duel games."""
    
    def __init__(self):
        self.games: Dict[str, GameSession] = {}
    
    def create_game(self, player1_name: str, player2_name: str) -> str:
        """Create a new game session between two players.
        
        Args:
            player1_name: Name of the first player
            player2_name: Name of the second player
            
        Returns:
            The unique game ID
        """
        game_id = str(uuid.uuid4())
        
        # Define candy emojis to match frontend
        candy_emojis = [
            '🍬', '🍭', '🍫', '🧁', '🍰', '🎂', '🍪', '🍩', '🍯', '🍮',
            '🧊', '🍓', '🍒', '🍑', '🥭', '🍍', '🥝', '🍇', '🫐', '🍉',
            '🍊', '🍋', '🍌', '🍈', '🍎', '🍏', '🥥', '🥕', '🌽', '🥜'
        ]
        
        import random
        
        # Each player gets 12 random different candies (corrected gameplay)
        all_candies = candy_emojis.copy()
        random.shuffle(all_candies)
        
        player1_candies = set(all_candies[:12])
        player2_candies = set(all_candies[12:24] if len(all_candies) >= 24 else all_candies[12:] + all_candies[:12-len(all_candies[12:])])
        
        player1 = Player(
            id=str(uuid.uuid4()), 
            name=player1_name,
            owned_candies=player1_candies
        )
        player2 = Player(
            id=str(uuid.uuid4()), 
            name=player2_name,
            owned_candies=player2_candies
        )
        
        game = GameSession(
            id=game_id,
            player1=player1,
            player2=player2
        )
        
        self.games[game_id] = game
        return game_id
    
    def set_poison_choice(
        self, 
        game_id: str, 
        player_id: str, 
        poison_candy: str
    ) -> bool:
        """Set a player's poison choice from their own candy pool (Version A).
        
        Args:
            game_id: The game ID
            player_id: The player making the poison choice
            poison_candy: The candy from their own pool to poison
            
        Returns:
            True if successful, False otherwise
        """
        if game_id not in self.games:
            return False
        
        game = self.games[game_id]
        if game.state != GameState.SETUP:
            return False
        
        # Find the player
        if game.player1.id == player_id:
            target_player = game.player1
        elif game.player2.id == player_id:
            target_player = game.player2
        else:
            return False
        
        # Check if player has already set their poison
        if target_player.poison_choice is not None:
            return False  # Poison already set, cannot change
        
        # VERSION A: Validate poison candy is from PLAYER'S OWN pool
        if poison_candy not in target_player.owned_candies:
            return False
        
        # Set poison choice
        target_player.poison_choice = poison_candy
        
        # Check if both players have made their poison choices
        if game.player1.poison_choice and game.player2.poison_choice:
            game.state = GameState.PLAYING
        
        game.last_updated = time.time()
        return True
    
    def make_move(
        self, 
        game_id: str, 
        player_id: str, 
        candy: str
    ) -> Dict[str, Any]:
        """Make a move (pick a candy from opponent's pool).
        
        Args:
            game_id: The game ID
            player_id: The player making the move
            candy: The candy to pick from opponent's pool
            
        Returns:
            Dictionary with success status and game information
        """
        if game_id not in self.games:
            return {"success": False, "error": "Game not found"}
        
        game = self.games[game_id]
        
        if game.state != GameState.PLAYING:
            return {"success": False, "error": "Game not in playing state"}
        
        # Determine whose turn it is
        current_player = (
            game.player1 if game.current_turn % 2 == 1 else game.player2
        )
        opponent_player = (
            game.player2 if current_player == game.player1 else game.player1
        )
        
        if current_player.id != player_id:
            return {"success": False, "error": "Not your turn"}
        
        # Validate candy is from opponent's pool and not already collected
        if candy not in opponent_player.owned_candies:
            return {"success": False, "error": "Candy not from opponent's pool"}
        
        # Check if candy is already collected or is opponent's poison
        if candy in current_player.collected_candies:
            return {"success": False, "error": "Candy already collected"}
        
        if candy in opponent_player.collected_candies:
            return {"success": False, "error": "Candy already collected by opponent"}
        
        # Make the move
        current_player.collected_candies.append(candy)
        
        # Check win conditions
        result = self._check_game_end(game, current_player, candy)
        
        if result != GameResult.ONGOING:
            game.state = GameState.FINISHED
            game.result = result
        else:
            game.current_turn += 1
        
        game.last_updated = time.time()
        
        return {
            "success": True,
            "game_state": self._get_game_state(game),
            "result": result.value if result else None,
            "current_turn": game.current_turn,
            "game_over": result != GameResult.ONGOING
        }
    
    def _check_game_end(
        self, 
        game: GameSession, 
        current_player: Player, 
        picked_candy: str
    ) -> GameResult:
        """Check if game should end and return result.
        
        Args:
            game: The game session
            current_player: The player who just made a move
            picked_candy: The candy that was just picked
            
        Returns:
            The game result
        """
        opponent_player = (
            game.player2 if current_player == game.player1 else game.player1
        )
        
        # DEATH CONDITION: If current player picked opponent's poison, current player LOSES
        if picked_candy == opponent_player.poison_choice:
            # Current player LOSES (dies) because they picked opponent's poison
            return GameResult.PLAYER2_WIN if current_player == game.player1 else GameResult.PLAYER1_WIN
        
        # DRAW CONDITION: If both players have collected 11 candies (only poisons remain)
        # Each player starts with 12, if they've collected 11 from opponent, only poison remains
        if (len(current_player.collected_candies) == 11 and 
            len(opponent_player.collected_candies) == 11):
            return GameResult.DRAW
        
        # Game continues if no end condition met
        
        return GameResult.ONGOING
    
    def _get_game_state(self, game: GameSession) -> Dict[str, Any]:
        """Get current game state for client.
        
        Args:
            game: The game session
            
        Returns:
            Dictionary containing the current game state
        """
        # Calculate available candies for picking (corrected gameplay):
        # Player 1 picks from Player 2's owned candies (minus already collected)
        # Player 2 picks from Player 1's owned candies (minus already collected)
        all_collected = set(game.player1.collected_candies + game.player2.collected_candies)
        
        player1_can_pick_from = game.player2.owned_candies - all_collected  # Player 1 picks from Player 2's owned
        player2_can_pick_from = game.player1.owned_candies - all_collected  # Player 2 picks from Player 1's owned
        
        return {
            "game_id": game.id,
            "state": game.state.value,
            "current_turn": game.current_turn,
            "player1": {
                "id": game.player1.id,
                "name": game.player1.name,
                "owned_candies": sorted(list(game.player1.owned_candies)),  # TOP GRID (12 candies)
                "collected_candies": game.player1.collected_candies,
                "candy_count": len(game.player1.collected_candies),
                "available_to_pick": sorted(list(player1_can_pick_from)),  # Can pick from Player 2's owned
                "has_set_poison": game.player1.poison_choice is not None,
                "remaining_owned": sorted(list(game.player1.owned_candies - all_collected))  # What's left of Player 1's owned
            },
            "player2": {
                "id": game.player2.id,
                "name": game.player2.name,
                "owned_candies": sorted(list(game.player2.owned_candies)),  # BOTTOM GRID (12 candies)
                "collected_candies": game.player2.collected_candies,
                "candy_count": len(game.player2.collected_candies),
                "available_to_pick": sorted(list(player2_can_pick_from)),  # Can pick from Player 1's owned
                "has_set_poison": game.player2.poison_choice is not None,
                "remaining_owned": sorted(list(game.player2.owned_candies - all_collected))  # What's left of Player 2's owned
            },
            "current_player": (
                game.player1.id if game.current_turn % 2 == 1 
                else game.player2.id
            ),
            "setup_complete": game.state == GameState.PLAYING
        }
    
    def get_game_state(self, game_id: str) -> Optional[Dict[str, Any]]:
        """Get game state by ID.
        
        Args:
            game_id: The game ID
            
        Returns:
            Game state dictionary or None if game not found
        """
        if game_id not in self.games:
            return None
        
        game = self.games[game_id]
        state = self._get_game_state(game)
        
        # Add end game information if finished
        if game.state == GameState.FINISHED:
            state["result"] = game.result.value
            state["poison_reveal"] = {
                "player1_poison": game.player1.poison_choice,
                "player2_poison": game.player2.poison_choice
            }
        
        return state
    
    def get_player_games(self, player_name: str) -> List[Dict[str, Any]]:
        """Get all games for a player.
        
        Args:
            player_name: The player's name
            
        Returns:
            List of game state dictionaries
        """
        player_games = []
        for game in self.games.values():
            if (game.player1.name == player_name or 
                game.player2.name == player_name):
                player_games.append(self._get_game_state(game))
        return player_games
    
    def cleanup_old_games(self, max_age_hours: int = 24) -> int:
        """Remove old games to free memory.
        
        Args:
            max_age_hours: Maximum age of games to keep in hours
            
        Returns:
            Number of games removed
        """
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        games_to_remove = []
        for game_id, game in self.games.items():
            if current_time - game.last_updated > max_age_seconds:
                games_to_remove.append(game_id)
        
        for game_id in games_to_remove:
            del self.games[game_id]
        
        return len(games_to_remove)
    
    def load_game_from_data(self, db_game: Dict[str, Any]) -> bool:
        """Load a game from database data into memory.
        
        Args:
            db_game: Game data from database
            
        Returns:
            True if successful, False otherwise
        """
        try:
            game_id = db_game["id"]
            game_state = db_game["game_state"]
            
            # Reconstruct players
            player1_data = game_state["player1"]
            player2_data = game_state["player2"]
            
            player1 = Player(
                id=player1_data["id"],
                name=player1_data["name"],
                owned_candies=set(player1_data["owned_candies"]),
                collected_candies=player1_data["collected_candies"],
                poison_choice=player1_data.get("poison_choice")
            )
            
            player2 = Player(
                id=player2_data["id"],
                name=player2_data["name"],
                owned_candies=set(player2_data["owned_candies"]),
                collected_candies=player2_data["collected_candies"],
                poison_choice=player2_data.get("poison_choice")
            )
            
            # Reconstruct game session
            game = GameSession(
                id=game_id,
                player1=player1,
                player2=player2,
                state=GameState(game_state["state"]),
                current_turn=game_state["current_turn"],
                result=GameResult(game_state["result"]),
                created_at=game_state.get("created_at", time.time()),
                last_updated=game_state.get("last_updated", time.time())
            )
            
            self.games[game_id] = game
            return True
            
        except Exception as e:
            print(f"Error loading game from database: {e}")
            return False 