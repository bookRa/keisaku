# Keisaku
## Training a Medit-_AI_-tion assisitant
## Step 1 - Collecting EEG data from an OpenBCI headset for later processing
Out of conveninence/laziness, I have chosen to use the OpenBCI GUI rather than configure a direct USB connection and use BrainFlow natively. Therefore, this repo 
implements a simple JavaScript UDP server which streams the received data straight to a CSV.

### Assumptions / Usage
1. Start the Keisaku App by running `node udpServers.js`
2. Start up the OpenBCI GUI and configure the _Networking Widget_ to stream UDP to the Address running Keisaku. In my case, I am streaming from Windows to Windows Subsystem for Linux. The IP is printed by the Keisaku once it is run.
![setup with IP and Networking Widget](/help_screenshots/setup_ip_addr.png?raw=true "Insert IP from app console into the Networking Widget")
3. After ensuring the headset is collecting good brain data (i.e. running impedence checks, etc), click `Start UDP Stream`
4. In the keisaku terminal, press `s` to being collecting and storing the streamed data. The App is currently setup to collect and store Aux/Digital Button Press, Focus Widget Output, and the Raw Timeseries data (with filters). There are additional methods for collecting & parsing BandPower (currently commented out). Any other GUI output can be enabled by creating a parsing function (based on data format as definied in the [OpenBCI Docs](https://docs.google.com/document/d/e/2PACX-1vR_4DXPTh1nuiOwWKwIZN3NkGP3kRwpP4Hu6fQmy3jRAOaydOuEI1jket6V4V6PG4yIG15H1N7oFfdV/pub)). 
5. When you're done meditating, click `Stop Data Stream` and `System Control Panel > Stop Session`. This allows the GUI to save its raw Session data (which Keisaku will look for and try to upload). _Then_ press `c` in the console to close the UDP servers and begin uploading the data.

## Step 2 - Uploading Collected Data to a Cloud Datastore

6. My repo is set up to upload the data created by the UDP servers, as well as the latest GUI-generated raw data, to an S3 bucket defined in a `.env` file in the root of the repo. Store your corresponding AWS credentials (`AWS_REGION`, `AWS_KEISAKU_ACCESS_KEY_ID`, `AWS_KEISAKU_SECRET_ACCESS_KEY`) in a `.env` or modify for your Cloud Store of choice.

## Step 3 - Work with the Data in your new Data Lake using a Data Platform of your choice.

7. I've personally chosen [DataBricks](https://databricks.com/) to [mount S3 Bucket](https://docs.databricks.com/data/data-sources/aws/amazon-s3.html#mount-a-bucket-using-an-aws-instance-profile&language-python) and begin exploring my data. However I'm not an expert in the whole platform ecosystem. There may be a better option for price and ease-of-use considerations. Or, of course, you can start writing Jupyter notebooks locally to explore your data!

