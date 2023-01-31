import mongoose from 'mongoose';
import EventEmitter from "events";
import {PawnSchema, IPawn} from "./schemas/pawnSchema";
import {EventSchema, IEvent} from "./schemas/eventSchema";


const eventBus = new EventEmitter();
export { eventBus };
mongoose.connect(process.env.MONGODB_URI).catch(e => {
    console.error(e);
    console.log("\n\n\nUnrecoverable error connecting to database. Exiting...");
    process.exit(1);
});

const db = mongoose.connection;

let Pawn
let Event
db.once('open', () => {
    let pawnSchema = new mongoose.Schema<IPawn>(PawnSchema);
    Pawn = mongoose.model('Pawn', pawnSchema);
    let eventSchema = new mongoose.Schema<IEvent>(EventSchema);
    Event = mongoose.model('Event', eventSchema);

    // The database manager is ready, emit an event.
    eventBus.emit('ready');
});

const getPawn = () => {
    return Pawn;
}
const getEvent = () => {
    return Event;
}

export { getPawn, getEvent }