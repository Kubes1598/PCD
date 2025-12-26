export type CandyCategory = 'common' | 'uncommon' | 'rare' | 'special';

export const CANDY_POOLS: Record<CandyCategory, string[]> = {
    common: [
        '🍎', '🍊', '🍌', '🍇', '🍓', '🍒', '🍑', '🍐', '🍋', '🍉',
        '🥕', '🍅', '🥒', '🧄', '🧅', '🥔', '🌽', '🥖', '🍞', '🥚'
    ],
    uncommon: [
        '🍏', '🍋‍🟩', '🫐', '🥭', '🍈', '🍍', '🥥', '🥑', '🥝', '🫛',
        '🌶️', '🫒', '🥦', '🫑', '🍆', '🥬', '🫜', '🍠', '🧇', '🧀'
    ],
    rare: [
        '🥞', '🧈', '🍖', '🍗', '🌭', '🥩', '🌮', '🌯', '🥙', '🥗',
        '🧆', '🍕', '🫔', '🦴', '🍝', '🍜', '🍥', '🌰', '🍫', '🍵'
    ],
    special: [
        '🍰', '🍬', '🍭', '🍪', '🍩', '🎂', '🧁', '🍯', '🍮', '🥧'
    ]
};

export const CITY_RULES = {
    Dubai: { common: 6, uncommon: 4, rare: 2, special: 0 },
    Cairo: { common: 4, uncommon: 4, rare: 3, special: 1 },
    Oslo: { common: 2, uncommon: 4, rare: 4, special: 2 }
};

const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export const generateCandyPool = (city: keyof typeof CITY_RULES = 'Dubai') => {
    const rules = CITY_RULES[city] || CITY_RULES.Dubai;
    let masterPool: string[] = [];

    Object.entries(rules).forEach(([category, count]) => {
        const pool = CANDY_POOLS[category as CandyCategory];
        const selected = shuffle(pool).slice(0, count);
        masterPool = [...masterPool, ...selected];
    });

    // Ensure minimum 24 candies
    if (masterPool.length < 24) {
        const needed = 24 - masterPool.length;
        const extra = shuffle(CANDY_POOLS.common).slice(0, needed);
        masterPool = [...masterPool, ...extra];
    }

    const shuffledMaster = shuffle(masterPool);
    // Split 12 for each player
    return {
        player: shuffledMaster.slice(0, 12),
        opponent: shuffledMaster.slice(12, 24)
    };
};
