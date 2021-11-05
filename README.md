# Keisaku
## Training a Medit-_AI_-tion assisitant
## Step 1 - Collecting EEG data from an OpenBCI headset for later processing
Out of conveninence/laziness, I have chosen to use the OpenBCI GUI rather than configure a direct USB connection and use BrainFlow natively. Therefore, this repo 
implements a simple JavaScript UDP server which streams the received data straight to a CSV