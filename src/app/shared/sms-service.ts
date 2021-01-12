import { Injectable } from '@angular/core';
import * as TNSInbox from 'nativescript-sms-inbox';
import * as appSettings from 'tns-core-modules/application-settings';
import * as TNSsms from 'nativescript-temp-sms';

@Injectable({
  providedIn: 'root'
})
export class SmsService {
  phoneNum: string;
  message: string;
  dateMessage: string;

  public getInboxMessages() {
    TNSInbox.getInboxes({ max: 1 }).then((res) => {
      console.log(JSON.stringify(res));
    }, (err) => {
      console.log('Error: ' + err);
    });
  }
  public getInboxMessagesFromNumber() { //fromNumber = "0712345678"
    return new Promise((resolve, reject) => {
      this.phoneNum = appSettings.getString('phoneN', null);
      if (this.phoneNum.match(/(^\d{9})/)) {
        TNSInbox.getInboxesFromNumber('+48' + this.phoneNum, { max: 1 }).then((res) => {
          console.log(JSON.stringify(res));
          const obj = JSON.parse(JSON.stringify(res));
          console.log(obj.data[0].message, "hpsassssss!");
          this.message = obj.data[0].message;
          this.dateMessage = obj.data[0].date;
          appSettings.setString('dateMessage', this.dateMessage);
        }, (err) => {
          console.log('Error: ' + err);
        });
      } else {
        console.log(" Prosze podać nr tel. opiekuna");
      }
      resolve(),
        reject();
    });
  }
  sendSms() {
    const sms = android.telephony.SmsManager.getDefault();
    sms.sendTextMessage(this.phoneNum, null, "Pump status change was successful", null, null);
  }
  sendSmsBol(r) {
    const sms = android.telephony.SmsManager.getDefault();
    sms.sendTextMessage(this.phoneNum, null, "Bolus " + r.toString() +  "u was delivered", null, null);
  }

  sendBadSms() {
    const sms = android.telephony.SmsManager.getDefault();
    sms.sendTextMessage(this.phoneNum, null, "Something was wrong! Please check pump status.", null, null);
  }
  sendBadSms2(arg) {
    console.log("moze teraz!!" + arg);
    const sms = android.telephony.SmsManager.getDefault();
    sms.sendTextMessage(this.phoneNum, null, "Response from Med-Link: " + arg.toString(), null, null);
  }

}
