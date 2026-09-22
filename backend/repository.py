
import mysql.connector as sql

import os 
from dotenv import load_dotenv

from backend.error import DatabaseError
from backend.schema import CCTV

load_dotenv()

config = {
    "host":os.getenv("DB_HOST"),
    "database":os.getenv("DB_NAME"),
    "user":os.getenv("DB_USER"),
    "password":os.getenv("DB_PW")
    }
cnxpool =  sql.pooling.MySQLConnectionPool(
    pool_name="cctww",
    pool_size=5,
    **config
    )

def get_cctv(id:int) -> CCTV:
    connect = cnxpool.get_connection()
    try:
        with connect.cursor(dictionary=True) as cur:
            query = "SELECT * FROM cctv WHERE ID = %s"
            cur.execute(query,(id,))
            row = cur.fetchone()
            if row is None:
                raise DatabaseError()
            return CCTV(**row)
    except DatabaseError:
        raise
    except Exception as e:
        print("get_cctv Error",e)
        raise DatabaseError()
    finally:
        connect.close()