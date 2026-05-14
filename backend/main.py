import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from tavily import TavilyClient
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

MOCK_MODE = False
tavily = None
model = None

if not GEMINI_API_KEY or not TAVILY_API_KEY:
    print("⚠️  WARNING: API Keys missing! Switching to MOCK MODE.")
    MOCK_MODE = True
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        tavily = TavilyClient(api_key=TAVILY_API_KEY)
        model = genai.GenerativeModel(
            'gemini-2.0-flash',
            system_instruction="""You are FactSaathi, a strict WhatsApp fact-checker.

GOLDEN RULE: The search results must DIRECTLY and EXPLICITLY confirm the exact claim. Not just mention related topics.

VERDICT LOGIC:
- VERIFIED ✅ = Search results explicitly confirm this exact claim happened
- FAKE ❌ = Claim is impossible, contradicts facts, or search finds NO direct confirmation
- MISLEADING ⚠️ = Claim is partially true but twisted or missing key context

STRICT RULES:
1. If search results mention topics separately but NOT the specific claim = FAKE ❌
2. Dead people (Hitler died 1945, Mandela died 2013, MJ died 2009) doing anything = FAKE ❌
3. Organizations declaring wars, natural disasters, apocalypse = FAKE ❌
4. Miracle cures, free government schemes, WhatsApp charges = FAKE ❌
5. Sports results, elections, business news = VERIFIED only if search explicitly confirms it
6. If you are not sure = FAKE ❌, not VERIFIED

Think step by step:
1. What is the exact claim?
2. Do search results DIRECTLY confirm this exact claim?
3. If yes = VERIFIED, if no = FAKE

OUTPUT FORMAT:
**Verdict:** FAKE ❌
**Explanation:** One sentence explaining exactly why.
**Source:** Source name"""
        )
        print("✅ AI & Search Connected Successfully.")
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        MOCK_MODE = True

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VerificationRequest(BaseModel):
    text: str

def get_search_context(query: str):
    if not tavily:
        return "Search unavailable."
    try:
        print(f"🕵️ Searching: {query[:80]}...")
        r1 = tavily.search(
            query=f"fact check {query[:300]}",
            search_depth="advanced",
            max_results=5,
            include_answer=True
        )
        answer  = r1.get('answer', '')
        results = r1.get('results', [])
        context = ""
        if answer:
            context += f"Direct Answer: {answer}\n"
        for r in results:
            context += f"- {r['content'][:200]} (Source: {r['url']})\n"
        print("TAVILY:", context[:300])
        return context or "No results found."
    except Exception as e:
        print(f"Search Error: {e}")
        return "Search unavailable."        

def get_mock_response(text):
    t = text.lower()
    hoax_keywords = ['hitler','mandela','michael jackson','alive','bunker','lemon cure',
                     'hot water cure','free laptop','free mobile','whatsapp charge',
                     'unesco anthem','forward this','share before deleted']
    if any(k in t for k in hoax_keywords):
        return "**Verdict:** FAKE ❌\n**Explanation:** This is a known hoax or contradicts verified facts.\n**Source:** FactSaathi Fact Check"
    return "**Verdict:** VERIFIED ✅\n**Explanation:** This appears to be a plausible news claim.\n**Source:** FactSaathi"

@app.post("/verify")
async def verify_news(request: VerificationRequest):
    if MOCK_MODE:
        return {"verdict": get_mock_response(request.text)}
    try:
        search_context = get_search_context(request.text)
        
        prompt = f"""Your job is to fact-check this claim using ONLY the search results below.

CLAIM: "{request.text}"

SEARCH RESULTS:
{search_context}

Answer these 3 questions first:
1. Do the search results DIRECTLY mention this exact claim happening? (yes/no)
2. Do the search results CONTRADICT this claim? (yes/no)  
3. Is this claim physically/historically possible? (yes/no)

Then give your final verdict:
- If Q1=yes and Q3=yes → VERIFIED ✅
- If Q1=no → FAKE ❌
- If Q2=yes → FAKE ❌
- If Q3=no → FAKE ❌

OUTPUT FORMAT:
**Verdict:** FAKE ❌
**Explanation:** One sentence based purely on what search results say.
**Source:** Source from search results"""

        response = model.generate_content(prompt)
        return {"verdict": response.text}

    except Exception as e:
        print(f"❌ API ERROR: {e}")
        if "429" in str(e) or "quota" in str(e).lower() or "retry" in str(e).lower():
            return {"verdict": "**Verdict:** FAKE ❌\n**Explanation:** Rate limit hit — claim could not be verified against sources.\n**Source:** FactSaathi"}
        return {"verdict": get_mock_response(request.text)}

@app.post("/analyze-file")
async def analyze_file(file: UploadFile = File(...)):
    filename = file.filename.lower()
    ext = filename.split(".")[-1]
    if ext in ["mp4", "mp3", "wav", "mov", "avi"]:
        raise HTTPException(status_code=400, detail="⚠️ FactSaathi supports Text/Images only.")
    return {"message": "File accepted"}
