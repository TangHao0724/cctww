
import uuid
import random
import os
import jwt
import datetime
from dotenv import load_dotenv

from backend.repository import  change_game_status, create_result, create_user_and_game, get_cctv, get_current_stage, get_gameID, get_gameIDS_byquetionUID, get_question_create_at, get_ranking,get_life, quest_result, save_answer, save_question, select_question
from backend.schema import CCTV, Des, Option, Question, Rank,Raw_rank, Road_class, Send_data

load_dotenv()

def sev_rancctv():
    end = 2327
    target = random.randint(1,end)
    cctv = get_cctv(target)
    return cctv

def sev_cctv_byid(id:int):
    return get_cctv(id)

ran_name= [
    "塞車的人",
    "路怒症",
    "在客運上睡著的人",
    "新手駕駛",
    "老司機",
    "飛機駕駛",
    "愛睏女司機",
    "沒看過中間的後視鏡",
    "經過休息站忘記加油",
    "遠光燈沒關",
    "蠻牛套咖啡"
]
def create_game_session(name:str|None,email:str|None) -> str:
    
    if name is None or name == "":
        input_name = random.choice(ran_name)
    else:
        input_name = name

    gUUID = uuid.uuid4().hex
    create_user_and_game(input_name,email,gUUID)

    return gUUID

# 先排分數，在排耗時，列出排行，如果相同則並列。再依據比例計算排行
def ranking()-> list[Rank]:
    raw_list = get_ranking()

    ranklist = []
    for k,v in enumerate(raw_list):
        if k == 0:
            rank = 1
        elif (
            v.score == raw_list[k - 1].score
            and v.total_time == raw_list[k - 1].total_time
        ):
            rank = ranklist[-1].id
        else:
            rank = k + 1

        ranklist.append(
            Rank(
                id=rank,
                name=v.name,
                score=v.score,
                total_stage=v.total_stage,
                total_time=v.total_time,
                finish_at=v.finish_at,
                percent=f"{rank / len(raw_list):.2%}"
            )
        )
    return ranklist

ROAD_CLASS_NAME = {
    Road_class.NATIONAL: "國道",
    Road_class.PROVINCIAL_EXPRESSWAY: "快速道路",
    Road_class.CITY_EXPRESSWAY: "市區快速道路",
    Road_class.PROVINCIAL: "省道",
    Road_class.COUNTY: "縣道",
    Road_class.TOWNSHIP: "鄉道",
    Road_class.CITY: "市道",
}
def create_question(gameUUID:str,option_count:int) ->Question:
    # 先做最粗糙版本(
    # 1.隨機選擇一個CCTV 
    # 2.接著取ID生成UUID 
    # 3.在隨機挑三個點
    # 4.存成option 
    # 5.打包送出
    key = os.getenv("TOKEN_PW")
    quest_cctv = sev_rancctv()
    questionUUID = uuid.uuid4().hex
    payload = {
        "gameUUID":gameUUID,
        "questionUUID":questionUUID,
        "cctvID":quest_cctv.ID,
        "exp":datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
        }
    quest_cctv_token = jwt.encode(payload,key,algorithm="HS256")
    raw_options = [ sev_rancctv() for i in range(option_count-1)]
    raw_options.append(quest_cctv)
    random.shuffle(raw_options)
    options = []
    for j,k in enumerate(raw_options):
        option = Option(
            id=j,
            name= k.cctv_name,
        )
        if k.ID == quest_cctv.ID:
            ansID = j
        options.append(option)
    life = get_life(gameUUID)
    des = Des(
        dir=quest_cctv.dir,
        class_type=ROAD_CLASS_NAME[Road_class(quest_cctv.road_class)],
        name=quest_cctv.road_name,
        mile=quest_cctv.mile,
    )
    now_stage = get_current_stage(gameUUID)
    gameID = get_gameID(gameUUID)
    question = Question(
        questionID=questionUUID,
        question_cctvUUID=quest_cctv_token,
        game_stage=now_stage,
        options=options,
        life=life,
        des=des
    )
    save_question(gameID,question,ansID,quest_cctv.ID)
    return question

def search_question(gameUUID:str) ->Question|None:
    gameid = get_gameID(gameUUID)
    life = get_life(gameUUID)
    stage  =get_current_stage(gameUUID)
    

    raw = select_question(gameid,stage)
    if raw is None:
        return None
    
    quest_cctv = sev_cctv_byid(raw.question_cctvintID)

    payload = {
            "gameUUID":gameUUID,
            "questionUUID":raw.questionUUID,
            "cctvID":quest_cctv.ID,
            "exp":datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
            }
    key = os.getenv("TOKEN_PW")
    quest_cctv_token = jwt.encode(payload,key,algorithm="HS256")
    des = Des(
        dir=quest_cctv.dir,
        class_type=ROAD_CLASS_NAME[Road_class(quest_cctv.road_class)],
        name=quest_cctv.road_name,
        mile=quest_cctv.mile,
    )
    question = Question(
        questionID=raw.questionUUID,
        question_cctvUUID=quest_cctv_token,
        game_stage=raw.game_stage,
        des = des,
        options=raw.options,
        life=life
    )
    print("gameid:", gameid)
    print("stage:", stage)
    print("raw:", raw)
    return question

def create_quest_stream(token:str):
    key = os.getenv("TOKEN_PW")
    print("TOKEN:", repr(token))
    data =jwt.decode(token,key,algorithms=["HS256"])
    # 先不做驗證
    cctvID = data["cctvID"]
    cctv = get_cctv(cctvID)

    return cctv

def send_answer(answer: Send_data):
    gameIds = get_gameIDS_byquetionUID(answer.questionID)
    start_at = get_question_create_at(answer.questionID)
    taiwan_tz = datetime.timezone(datetime.timedelta(hours=8))
    start_at = start_at.replace(tzinfo=taiwan_tz)
    start_at = start_at.astimezone(datetime.timezone.utc)
    
    dt_start_at = datetime.datetime.fromtimestamp(
        answer.timestamp,
        tz=datetime.timezone.utc
    )
    print("start_at",start_at, start_at.tzinfo)
    print("dt_start_at",dt_start_at, dt_start_at.tzinfo)
    
    elapsed = int(
            (dt_start_at - start_at).total_seconds() * 1000
        )
    if elapsed > 10_000:
       raw_result = save_answer(answer.questionID,None,elapsed,dt_start_at)
    else:
        raw_result = save_answer(answer.questionID,answer.ansID,elapsed,dt_start_at)
    quest = quest_result(raw_result)
    if quest.life <= 0:
        print("遊戲結束")
        change_game_status(gameIds.UUID,"finish")
        return quest
        
    else:   
        return quest

def leave(gameUUID:str):
    change_game_status(gameUUID,"leaved")

def ser_result(gameUUID:str):
    return create_result(gameUUID)