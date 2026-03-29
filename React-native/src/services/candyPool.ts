export type CandyCategory = 'common' | 'uncommon' | 'rare' | 'special';

export const CANDY_POOLS: Record<CandyCategory, string[]> = {
    common: [
        '🍬', '🍭', '🍫', '🍩', '🍪', '🍥', '🍡', '🍧', '🍨', '🍦'
    ],
    uncommon: [
        '🧁', '🍰', '🎂', '🍮', '🥧', '🍯', '🥞', '🧇', '🥮', '🥐'
    ],
    rare: [
        '🍓', '🍒', '🍑', '🫐', '🍉', '🍍', '🥭', '🍈', '🍇', '🍏'
    ],
    special: [
        '🌰', '🥨', '🍿', '🥤', '🧋', '🍡', '🍭', '🍫', '🍧', '🍩'
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
    const masterPoolSet = new Set<string>();

    // 1. Fill based on city rules
    Object.entries(rules).forEach(([category, count]) => {
        const pool = CANDY_POOLS[category as CandyCategory];
        const shuffled = shuffle(pool);
        let added = 0;
        for (const candy of shuffled) {
            if (added >= count) break;
            if (!masterPoolSet.has(candy)) {
                masterPoolSet.add(candy);
                added++;
            }
        }
    });

    // 2. Ensure exactly 24 unique candies
    const allAvailable = shuffle([
        ...CANDY_POOLS.common,
        ...CANDY_POOLS.uncommon,
        ...CANDY_POOLS.rare,
        ...CANDY_POOLS.special
    ]);

    for (const candy of allAvailable) {
        if (masterPoolSet.size >= 24) break;
        masterPoolSet.add(candy);
    }

    const shuffledMaster = shuffle(Array.from(masterPoolSet));

    // Split 12 for each player - guaranteed unique across both
    return {
        player: shuffledMaster.slice(0, 12),
        opponent: shuffledMaster.slice(12, 24)
    };
};
