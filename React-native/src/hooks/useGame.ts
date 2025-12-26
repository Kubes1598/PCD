import { useGameStore, GameMode, Difficulty } from '../store/gameStore';

export const useGame = () => {
    const store = useGameStore();

    return {
        ...store,
        // Add any component-specific helper logic here
    };
};
