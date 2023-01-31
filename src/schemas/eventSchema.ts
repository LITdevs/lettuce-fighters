const EventSchema = {
    timestamp: Date,
    eventText: String
}

interface IEvent {
    timestamp: Date,
    eventText: string
}

export {EventSchema, IEvent}