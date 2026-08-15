from fastapi import APIRouter, HTTPException

from .schema import AppointmentNotificationAccepted, AppointmentNotificationRequest
from .service import (
    NotificationConfigError,
    NotificationDeliveryError,
    send_appointment_notification_email,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post(
    "/appointments",
    response_model=AppointmentNotificationAccepted,
    status_code=200,
    responses={
        500: {"description": "Notification configuration error"},
        502: {"description": "Unable to send appointment email"},
    },
)
async def enqueue_appointment_notification(request: AppointmentNotificationRequest):
    try:
        result = await send_appointment_notification_email(request)
    except NotificationConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except NotificationDeliveryError as exc:
        raise HTTPException(status_code=502, detail="Unable to send appointment email") from exc

    return AppointmentNotificationAccepted(
        delivery_message_id=result["delivery_message_id"],
        correlation_id=result["correlation_id"],
    )
