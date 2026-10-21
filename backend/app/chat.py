"""LLM interprets language; only server-rendered database facts reach customers."""

import json
import re
from pathlib import Path
from datetime import timedelta
import httpx
from sqlalchemy import select
from . import db
from .config import settings
from .domain import availability, now

PROMPT = (
    Path(__file__).resolve().parents[2] / "docs/chatbot_system_prompt.txt"
).read_text()
FORBIDDEN = re.compile(
    r"home\s*delivery|deliver|ignore|override|system\s*prompt|api.?key|environment|secret|password|instructions|cricket|president|weather|politic",
    re.I,
)


def uncertain_combination(message, services):
    """Conservative fallback: never price only the recognized half of a bundle."""
    remainder = message.lower()
    found = False
    for service in services:
        name = service["name"].lower()
        if name in remainder:
            found = True
            remainder = remainder.replace(name, " ")
    if not found or not re.search(
        r"\b(total|and|aur|ani|plus|with)\b|आणि|और|एकूण", remainder
    ):
        return False
    safe_words = set(
        "what is are the a an how much for of and aur ani plus with total combined price prices cost costs ka ki ke kitna kitne kiti hai hain hoga honge please tell me can you mala chi sanga lagel together charge charges would be in rupees rs all both".split()
    )
    # Unrecognized vocabulary gets clarification, rather than a partial quote.
    tokens = re.findall(r"[^\W\d_]+", remainder)
    return any(token not in safe_words for token in tokens)


def interpret(message, services):
    lower = message.lower()
    language = (
        "mr"
        if re.search(r"\b(mala|sanga|chi|kiti)\b|मला|सांगा", lower)
        else (
            "hi"
            if re.search(
                r"\b(ka|kitna|kitne|hai|kya|aaj|baje|kal|aur)\b|[\u0900-\u097f]", lower
            )
            else "en"
        )
    )
    ids = [s["id"] for s in services if s["name"].lower() in lower]
    topic = "unknown"
    if FORBIDDEN.search(lower):
        topic = "refuse"
    elif uncertain_combination(message, services):
        topic = "unknown"
    elif re.search(r"cancel|reschedul|policy|refund", lower):
        topic = "policy"
    elif re.search(r"available|availability|slot|aaj|tomorrow|कल|आज", lower):
        topic = "availability"
    elif re.search(r"minute|duration|lagega|किती वेळ", lower):
        topic = "duration"
    elif re.search(r"price|cost|total|kitna|kiti|किंमत|कितना", lower):
        topic = "price" if ids else "unknown"
    elif re.search(r"hour|open|close|timing", lower):
        topic = "hours"
    elif re.search(r"book|appointment", lower):
        topic = "booking"
    elif re.search(r"service|menu|offer", lower) or ids:
        topic = "catalogue"
    day = now().date()
    date_match = re.search(r"\b\d{4}-\d{2}-\d{2}\b", lower)
    selected_date = (
        date_match.group()
        if date_match
        else (
            (day + timedelta(days=1)).isoformat()
            if "tomorrow" in lower
            else day.isoformat()
            if re.search(r"today|aaj|आज", lower)
            else None
        )
    )
    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", lower)
    time = None
    if time_match:
        hour, minute, period = (
            int(time_match[1]),
            int(time_match[2] or 0),
            time_match[3],
        )
        if 1 <= hour <= 12 and minute < 60:
            time = f"{hour % 12 + (12 if period == 'pm' else 0):02d}:{minute:02d}"
    return {
        "topic": topic,
        "service_ids": ids,
        "language": language,
        "date": selected_date,
        "time": time,
    }


async def respond(message):
    with db.engine.connect() as conn:
        services = [
            dict(s)
            for s in conn.execute(
                select(db.services).where(db.services.c.active.is_(True))
            ).mappings()
        ]
    intent = interpret(message, services)
    mode = "fallback"
    if (
        intent["topic"] != "refuse"
        and not uncertain_combination(message, services)
        and settings.llm_api_key
    ):
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.post(
                    settings.llm_base_url.rstrip("/") + "/chat/completions",
                    headers={"Authorization": "Bearer " + settings.llm_api_key},
                    json={
                        "model": settings.llm_model,
                        "temperature": 0,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {
                                "role": "system",
                                "content": PROMPT
                                + "\nVerified context: "
                                + json.dumps(
                                    {
                                        "services": services,
                                        "today": now().date().isoformat(),
                                        "hours": [
                                            settings.salon_open,
                                            settings.salon_close,
                                        ],
                                    }
                                ),
                            },
                            {"role": "user", "content": message},
                        ],
                    },
                )
                response.raise_for_status()
                candidate = json.loads(
                    response.json()["choices"][0]["message"]["content"]
                )
            if candidate.get("topic") not in {
                "catalogue",
                "price",
                "duration",
                "hours",
                "availability",
                "booking",
                "policy",
                "unknown",
                "refuse",
            }:
                raise ValueError("Invalid topic")
            if candidate.get("language") not in {"en", "hi", "mr"} or not isinstance(
                candidate.get("service_ids"), list
            ):
                raise ValueError("Invalid classification")
            if any(
                type(i) is not int or i not in [s["id"] for s in services]
                for i in candidate["service_ids"]
            ):
                raise ValueError("Unknown service")
            intent = {
                k: candidate.get(k)
                for k in ["topic", "language", "service_ids", "date", "time"]
            }
            mode = "llm"
        except (httpx.HTTPError, KeyError, ValueError, TypeError, IndexError):
            pass
    topic, lang = intent["topic"], intent["language"]
    selected = [s for s in services if s["id"] in intent["service_ids"]]

    def local(en, hi, mr):
        return {"en": en, "hi": hi, "mr": mr}[lang]

    if topic == "refuse":
        answer = local(
            "I can help with salon services and appointments only. Please use the booking form to reserve a visit.",
            "Main sirf salon services aur appointments mein madad kar sakta hoon. Booking ke liye form use karein.",
            "मी फक्त सलून सेवा आणि अपॉइंटमेंटबद्दल मदत करू शकतो. बुकिंगसाठी फॉर्म वापरा.",
        )
    elif topic in ("price", "duration", "catalogue") and (
        selected or topic == "catalogue"
    ):
        rows = selected or services
        answer = "\n".join(
            f"{s['name']}: ₹{s['price_paise'] / 100:,.0f} · {s['duration']} min"
            for s in rows
        )
        if topic == "price":
            answer += (
                local("\nTotal: ", "\nKul: ", "\nएकूण: ")
                + f"₹{sum(s['price_paise'] for s in rows) / 100:,.0f}"
            )
        answer += local(
            "\nChoose a service in the booking form.",
            "\nBooking form mein service chunein.",
            "\nबुकिंग फॉर्ममध्ये सेवा निवडा.",
        )
    elif topic == "hours":
        answer = (
            local("Open daily", "Roz khula hai", "दररोज खुले")
            + f": {settings.salon_open}–{settings.salon_close} ({settings.salon_timezone})."
        )
    elif topic == "availability":
        if len(selected) != 1 or not isinstance(intent["date"], str):
            answer = local(
                "Which service and date? Please specify AM/PM for a time, or use the live booking form.",
                "Kaunsi service aur date? Time ke saath AM/PM batayein, ya live booking form use karein.",
                "कोणती सेवा आणि तारीख? वेळेसोबत AM/PM सांगा किंवा बुकिंग फॉर्म वापरा.",
            )
        else:
            from fastapi import HTTPException

            try:
                with db.engine.connect() as conn:
                    slots = availability(conn, intent["date"], selected[0]["id"])
                requested = intent["time"]
                if requested is not None and (
                    not isinstance(requested, str)
                    or not re.fullmatch(r"\d{2}:\d{2}", requested)
                ):
                    raise ValueError
                if requested:
                    answer = (
                        f"{selected[0]['name']} · {intent['date']} {requested}: "
                        + (
                            local("available now", "abhi available hai", "आत्ता उपलब्ध")
                            if requested in slots
                            else local(
                                "unavailable", "available nahi hai", "उपलब्ध नाही"
                            )
                        )
                    )
                else:
                    answer = f"{selected[0]['name']} · {intent['date']}: " + (
                        ", ".join(slots)
                        if slots
                        else local(
                            "No free slots.", "Koi slot nahi hai.", "स्लॉट उपलब्ध नाही."
                        )
                    )
                answer += local(
                    "\nAvailability can change. Submit the form to request a booking.",
                    "\nSlots badal sakte hain. Booking ke liye form submit karein.",
                    "\nउपलब्धता बदलू शकते. बुकिंगसाठी फॉर्म भरा.",
                )
            except (HTTPException, ValueError):
                answer = local(
                    "Please choose a valid future date and time in the booking form.",
                    "Booking form mein sahi date aur time chunein.",
                    "बुकिंग फॉर्ममध्ये योग्य तारीख आणि वेळ निवडा.",
                )
    elif topic == "booking":
        answer = local(
            "Choose a service, date and available slot in the booking form. Add your name and 10-digit phone number, then submit. I cannot make bookings in chat.",
            "Form mein service, date aur available time chunein. Naam aur 10-digit phone bharein. Chat se booking nahi hoti.",
            "फॉर्ममध्ये सेवा, तारीख आणि उपलब्ध वेळ निवडा. नाव आणि १० अंकी फोन भरा. चॅटमधून बुकिंग होत नाही.",
        )
    elif topic == "policy":
        answer = local(
            "Contact the salon owner to reschedule or cancel. The owner can manage active bookings. Refund and cancellation-fee policies are not currently available.",
            "Reschedule ya cancel karne ke liye salon owner se sampark karein. Refund aur cancellation fee ki jaankari abhi available nahi hai.",
            "वेळ बदलण्यासाठी किंवा रद्द करण्यासाठी सलून मालकाशी संपर्क करा. परतावा आणि रद्द शुल्काची माहिती सध्या उपलब्ध नाही.",
        )
    else:
        answer = local(
            "That information is not currently available. Ask about a listed service, price, duration, hours or appointment availability.",
            "Yeh jaankari abhi available nahi hai. Listed service, price, duration, hours ya slots ke baare mein poochhein.",
            "ही माहिती सध्या उपलब्ध नाही. उपलब्ध सेवा, किंमत, वेळ किंवा स्लॉटबद्दल विचारा.",
        )
    return {
        "answer": answer,
        "mode": mode,
        "notice": "Live database assistant"
        if mode == "llm"
        else "Basic database assistant · AI unavailable or not configured",
    }
