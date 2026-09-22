from fastapi import *
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from cctv import router as cctv_router
from game_api import router as game_router, start_game


app =FastAPI()
app.include_router(cctv_router)
app.include_router(game_router)

@app.post('/api/sign')
async def sign():
	return {'OK': True, **(await start_game())}
BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "frontend"))
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@app.get("/", include_in_schema=False)
async def index(request: Request):
	return FileResponse("./frontend/index.html", media_type="text/html")

@app.get("/game", include_in_schema=False)
async def attraction(request: Request):
	return templates.TemplateResponse(request=request, name="game.html")

@app.get("/result", include_in_schema=False)
async def booking(request: Request):
	return FileResponse("./frontend/result.html", media_type="text/html")
