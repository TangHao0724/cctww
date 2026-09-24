from fastapi import *
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.service import create_game_session, create_quest_stream, create_question, leave, ranking, search_question, send_answer, ser_result, sev_cctv_byid, sev_rancctv
from backend.schema import CCTV, Leave_data, Send_data, SignRequest

import requests


app =FastAPI()

app.mount("/frontend", StaticFiles(directory="frontend", html=True), name="frontend")

@app.get("/", include_in_schema=False)
async def index(request: Request):
	return FileResponse("./frontend/index.html", media_type="text/html")

@app.get("/game", include_in_schema=False)
async def attraction(request: Request):
	return FileResponse("./frontend/game.html", media_type="text/html")

@app.get("/result", include_in_schema=False)
async def booking(request: Request):
	return FileResponse("./frontend/result.html", media_type="text/html")

# api
@app.post('/api/sign',tags=["/index"])
async def sign_in(sign:SignRequest):
	gameUUID  = create_game_session(sign.name,sign.email)
	return JSONResponse({"OK":True,"gameID":gameUUID},status_code=status.HTTP_201_CREATED)

@app.get('/api/rencctv',tags=["/index"])
async def get_rencctv():
	cctv = sev_rancctv().stream_url
	response = requests.get(cctv, stream=True,verify=False)

	return StreamingResponse(
		response.iter_content(chunk_size=8192),
		media_type=response.headers.get(
			"content-type",
			"multipart/x-mixed-replace"
		)
	)


@app.get('/api/cctv',tags=["/index"])
async def get_cctv(ID:int):
	cctv = sev_cctv_byid(ID)
	
	response = requests.get(cctv, stream=True,verify=False)
	
	return StreamingResponse(
		response.iter_content(chunk_size=8192),
		media_type=response.headers.get(
			"content-type",
			"multipart/x-mixed-replace"
		)
	)

@app.get("/api/ranking",tags=["/index"])
async def get_ranking():
	rlist = ranking()
	return JSONResponse(
        content=jsonable_encoder({"ranking_list": rlist}),
        status_code=status.HTTP_200_OK
    )

@app.get("/api/game/question",tags=["/game"])
async def get_question(gameID:str):
	quest = search_question(gameID)
	if quest is None:
		quest = create_question(gameID,4)

	return JSONResponse(quest.model_dump(),status_code=status.HTTP_200_OK)

@app.get("/api/game/cctv",tags=["/game"])
async def get_game_cctv(UUID:str):

	url = create_quest_stream(UUID).stream_url
	response = requests.get(url, stream=True,verify=False)

	return StreamingResponse(
		response.iter_content(chunk_size=8192),
		media_type=response.headers.get(
			"content-type",
			"multipart/x-mixed-replace"
		)
	)

@app.post("/api/game/send",tags=["/game"])
async def send_ans(answer:Send_data):
	result = send_answer(answer)
	return JSONResponse(result.model_dump(),status_code=status.HTTP_200_OK)


@app.post("/api/game/leave",tags=["/game"])
async def leave_game(data:Leave_data):
	result = leave(data.gameID)
	return JSONResponse({"OK":True},status_code=status.HTTP_200_OK)

@app.post("/api/game/result",tags=["/game"])
async def send_result(gameID:str):
	result = ser_result(gameID)
	return JSONResponse(result.model_dump(),status_code=status.HTTP_200_OK)


