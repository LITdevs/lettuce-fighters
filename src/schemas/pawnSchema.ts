const PawnSchema = {
    discordId: String,
    username: String,
    position: Object,
    alive: {type: Boolean, default: true},
    health: {type: Number, default: 3},
    actions: {type: Number, default: 1},
    tint: Object,
    diedAt: Date,
    killedBy: String,
    vote: String
}

interface IPawn {
    discordId: string,
    username: string,
    position: {x: number, y: number},
    alive: boolean,
    tint: {r: number, g: number, b: number},
    diedAt: Date,
    killedBy: string,
    vote: string
}

export {PawnSchema, IPawn}