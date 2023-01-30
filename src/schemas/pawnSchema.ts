import {Types} from "mongoose";

const PawnSchema = {
    discordId: String,
    position: Object,
    alive: {type: Boolean, default: true},
    diedAt: Date
}

interface IPawn {
    discordId: string,
    position: {x: number, y: number},
    alive: boolean,
    diedAt: Date
}

export {PawnSchema, IPawn}