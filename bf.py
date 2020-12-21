import argparse
from logging import debug
import os
import time
import numpy as np
from datetime import datetime
from brainflow.board_shim import BoardIds, BoardShim, BrainFlowInputParams, LogLevels
from brainflow.data_filter import DataFilter, FilterTypes, AggOperations

# from utils.logger import log_info, log_error 
def log_info(msg: str):
    BoardShim.log_message(LogLevels.LEVEL_INFO.value, msg)

def log_error(msg: str):
    BoardShim.log_message(LogLevels.LEVEL_ERROR.value, msg)

def log_debug(msg: str):
    BoardShim.log_message(LogLevels.LEVEL_DEBUG.value, msg)

#TODO complete
def fill_in_cyton_params() -> BrainFlowInputParams:
    return BrainFlowInputParams()

# parse args
parser = argparse.ArgumentParser()
parser.add_argument('--synth', help='set if wanting to use synth board only', action='store_true')
parser.add_argument('--buffer', help='seconds in between clearing buffer', type=int, default=3)
parser.add_argument('--debug', help='additional logging', action='store_true')
parser.set_defaults(synth = True) # TODO: Remove when ready to use real board
parser.set_defaults(debug = True)
args = parser.parse_args()

# initialize this session's file
cwd = os.getcwd()
sessions_archive = os.path.join(cwd, "sessions_archive")
todays_sessions_path = os.path.join(sessions_archive, datetime.today().strftime('%Y_%m_%d'))
os.makedirs(todays_sessions_path, exist_ok=True)
# assuming that there is one directory per session (i.e. morning and night)
todays_sessions = os.listdir(todays_sessions_path)
curr_sesh_name = f"Session_{len(todays_sessions)+1}"
if args.synth:
    curr_sesh_name += "_SYNTH"
current_session_dir = os.path.join(todays_sessions_path, curr_sesh_name)
os.mkdir(current_session_dir)
raw_data_path = os.path.join(current_session_dir, "raw_data.csv")

board_id =  BoardIds.SYNTHETIC_BOARD.value if args.synth else BoardIds.CYTON_DAISY_BOARD.value

sampling_rate = BoardShim.get_sampling_rate(board_id)
eegs = BoardShim.get_eeg_channels(board_id)
battery = BoardShim.get_battery_channel(board_id)
resistance = BoardShim.get_resistance_channels(board_id)
timestamp = BoardShim.get_timestamp_channel(board_id)
others = BoardShim.get_accel_channels(board_id) if args.synth else BoardShim.get_other_channels(board_id)
columns = ['timestamp'] + [f'ch_{x+1}' for x in range(len(eegs))] + [f'aux_{x+1}' for x in range(len(others))]
with open(raw_data_path, 'w') as raw:
    raw.write(','.join(columns) + '\n')

if args.debug:
    BoardShim.enable_dev_board_logger()
    for c in ['eegs', 'battery', 'resistance', 'others', 'timestamp']:
        log_debug(f'Channel for {c} is {eval(c)} ')
    log_debug(f"sampling rate is {sampling_rate} with board ID {board_id}")

DataFilter.write_file
BUFFER_TIME = args.buffer
params = BrainFlowInputParams() if args.synth else fill_in_cyton_params()
board = BoardShim(board_id=board_id, input_params=params)
board.prepare_session()
board.start_stream()

time.sleep(BUFFER_TIME)
for i in range(3): #TODO: make while(True) and elegantly shutdown when board is shutdown or keyboard interrupt
    data = board.get_board_data()
    indexes = [timestamp, *eegs, *others]
    data_to_write = data[indexes]
    DataFilter.write_file(data=data_to_write, file_name=raw_data_path, file_mode='a')
    log_debug(f"sample {i}:: data is {data} or len {len(data)}")
    time.sleep(1)

board.stop_stream()
board.release_session()