from fastapi import *
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from backend.service import sev_cctv_byid, sev_rancctv
from backend.schema import CCTV



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

@app.get('/api/rencctv',tags=["/index"])
async def get_rencctv():
	cctv = sev_rancctv()
	html = f"""
	<img 
	style="display: block;
	-webkit-user-select: none;
	margin: auto;
	background-color: hsl(0, 0%, 25%);" 
	src="{cctv.stream_url}" width="320" height="240">
	"""
	return HTMLResponse(html,status_code=status.HTTP_200_OK)

@app.get('/api/cctv',tags=["/index"])
async def get_cctv(ID:int):
	cctv = sev_cctv_byid(ID)
	
	html = f"""
	<img 
	style="display: block;-webkit-user-select: none;margin: auto;background-color: hsl(0, 0%, 90%);transition: background-color 300ms;" 
	src="{cctv.stream_url}">
	"""
	return HTMLResponse(html,status_code=status.HTTP_200_OK)
	