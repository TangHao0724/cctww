from fastapi import *
from fastapi.responses import FileResponse


app =FastAPI()

@app.get("/", include_in_schema=False)
async def index(request: Request):
	return FileResponse("./frontend/index.html", media_type="text/html")

@app.get("/game", include_in_schema=False)
async def attraction(request: Request):
	return FileResponse("./frontend/game.html", media_type="text/html")

@app.get("/result", include_in_schema=False)
async def booking(request: Request):
	return FileResponse("./frontend/result.html", media_type="text/html")