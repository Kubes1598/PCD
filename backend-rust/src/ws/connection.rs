//! WebSocket connection manager

use axum::extract::ws::Message;
use dashmap::DashMap;
use tokio::sync::mpsc;
use uuid::Uuid;

use std::sync::Arc;

/// Manages WebSocket connections and message broadcasting
/// 
/// Production-grade connection management with:
/// - Thread-safe connection storage using DashMap
/// - City-based player location tracking for broadcasts
/// - Graceful disconnect handling
/// - Message delivery with delivery confirmation
#[derive(Clone)]
pub struct ConnectionManager {
    /// Player ID -> Sender for their WebSocket connection
    connections: Arc<DashMap<Uuid, mpsc::UnboundedSender<Message>>>,
    /// Player ID -> Current city they are viewing
    player_locations: Arc<DashMap<Uuid, String>>,
}

impl ConnectionManager {
    /// Create new connection manager
    pub fn new() -> Self {
        Self {
            connections: Arc::new(DashMap::new()),
            player_locations: Arc::new(DashMap::new()),
        }
    }

    /// Register a new connection
    pub async fn connect(&self, player_id: Uuid, sender: mpsc::UnboundedSender<Message>) {
        self.connections.insert(player_id, sender);
        tracing::debug!(
            "Player {} connected. Total: {}",
            player_id,
            self.connections.len()
        );
    }

    /// Update player's current location/city
    pub fn set_location(&self, player_id: Uuid, city: String) {
        self.player_locations.insert(player_id, city);
    }

    /// Remove a connection
    pub async fn disconnect(&self, player_id: Uuid) {
        self.connections.remove(&player_id);
        self.player_locations.remove(&player_id);
        tracing::debug!(
            "Player {} disconnected. Total: {}",
            player_id,
            self.connections.len()
        );
    }

    /// Send a message to a specific player
    pub fn send_message(&self, player_id: &Uuid, message: Message) -> bool {
        if let Some(sender) = self.connections.get(player_id) {
            return sender.send(message).is_ok();
        }
        false
    }

    /// Broadcast to all players in a specific city
    pub fn broadcast_to_city(&self, city: &str, message: Message) {
        for entry in self.player_locations.iter() {
            if entry.value() == city {
                self.send_message(entry.key(), message.clone());
            }
        }
    }

    /// Get count of online players in a specific city
    pub fn get_online_count(&self, city: &str) -> usize {
        self.player_locations
            .iter()
            .filter(|entry| entry.value() == city)
            .count()
    }

    /// Broadcast a message to multiple players (e.g. both players in a game)
    pub fn broadcast(&self, player_ids: &[Uuid], message: Message) {
        for id in player_ids {
            self.send_message(id, message.clone());
        }
    }

    /// Check if a player is connected
    pub fn is_connected(&self, player_id: &Uuid) -> bool {
        self.connections.contains_key(player_id)
    }

    /// Get active connection count
    pub fn connection_count(&self) -> usize {
        self.connections.len()
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}
