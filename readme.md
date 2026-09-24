# CCTWW(透過CCTV猜目前在哪裡？)

透過交通部公開的xml資料，獲取所有在公路上的cctv資訊以及鏡頭。用選擇的方法讓玩家猜測！

# 這裡是dev，如果合併請找這裡

## 指令速記
pip freeze > requirements.txt 輸出環境的插件記錄到requirement
pip install -r requirements.txt 輸入requirement環境內所有插件
deactivate 離開環境

## 切換到此專案環境

# 切記測試時，將環境切換到專案內目前環境。

1. Powershell  執行 .venv/Scripts/activate.ps1  
2. 確認目前terminal開頭帶有(.venv)，代表進入環境
3. 如果不確定專案使否有新插件，執行pip install -r requirements.txt 安裝所有表上的插件做檢查
4. 如果有安裝插件，請使用 "pip freeze > requirements.txt " 將新增的插件更新到表上
5. 離開環境使用deactivate。