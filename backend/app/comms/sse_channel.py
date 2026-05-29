"""SSE kanalı — broadcast_announcement() üzerine kurulu CommsChannel impl."""

from app.comms.base import CommsChannel, CommsMessage


class SSEChannel(CommsChannel):
    channel_name = "sse"

    async def send(self, message: CommsMessage) -> None:
        from app.api.sse import broadcast_announcement

        payload = {"title": message.title, "body": message.body, **message.data}
        if message.url:
            payload["url"] = message.url
        await broadcast_announcement(message.event_type, payload)
