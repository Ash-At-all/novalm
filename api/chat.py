from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    model = body.get("model", "flash")
    contents = body.get("contents", [])
    system_instruction = body.get("system_instruction", {})

    # ── Cohere ──
    if model in ["flash", "pro", "openai"]:
        cohere_key = os.environ.get("COHERE_API_KEY")
        if not cohere_key:
            return JSONResponse({"error": "Cohere API key not configured"})

        # convert history to Cohere format
        chat_history = []
        for c in contents[:-1]:
            role = "CHATBOT" if c["role"] == "model" else "USER"
            chat_history.append({
                "role": role,
                "message": c["parts"][0]["text"]
            })

        last_message = contents[-1]["parts"][0]["text"]
        preamble = system_instruction.get("parts", [{}])[0].get("text", "")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.cohere.com/v1/chat",
                headers={
                    "Authorization": f"Bearer {cohere_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "command-a-03-2025",
                    "message": last_message,
                    "chat_history": chat_history,
                    "preamble": preamble,
                    "max_tokens": 1000
                },
                timeout=30
            )

        data = response.json()

        if "message" in data and "text" not in data:
            return JSONResponse({"error": data["message"]})

        # return in Gemini-like format so frontend stays same
        return JSONResponse({
            "candidates": [{
                "content": {
                    "parts": [{"text": data.get("text", "")}]
                }
            }]
        })