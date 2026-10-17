import json
import os
import re
from functools import cache

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

MODEL = "gpt-4o-mini"
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")


@cache
def _client():
    # Created on first use, so importing services (tests, CI) needs no API key.
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class AIUnavailable(Exception):
    pass


def chat(content, json_reply=False):
    try:
        response = _client().chat.completions.create(
            model=MODEL,
            temperature=0,
            messages=[{"role": "user", "content": content}],
        )
        text = response.choices[0].message.content.strip()
        return json.loads(_FENCE.sub("", text)) if json_reply else text
    except Exception as err:
        raise AIUnavailable(type(err).__name__) from err
