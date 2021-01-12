import { Injectable, NgZone} from "@angular/core";
import { DatabaseService } from "~/app/shared/database.service";
import { SmsService } from "~/app/shared/sms-service";
import { NightscoutApiService } from "~/app/shared/nightscout-api.service";
import { PumpBluetoothApiService } from "~/app/shared/pump-bluetooth-api.service";
import * as appSettings from "application-settings";

@Injectable({
  providedIn: "root"
})
export class SmsFacadeService {
  btData: string;
  bolhour: number;

  constructor(
    private databaseService: DatabaseService,
    private zone: NgZone,
    private smsService: SmsService,
    private nightscoutApiService: NightscoutApiService,
    private pumpBluetoothApiService: PumpBluetoothApiService,
  ) {
  }
  validateSms() {
    return new Promise((resolve) => {
      const phoneNumb = appSettings.getString('phoneN', null);
      if (phoneNumb !== null && phoneNumb !== 'ENTER PHONE NUMBER') {
        this.smsService.getInboxMessagesFromNumber().then(() => {
         console.log("to jest tresc " + this.smsService.message.toUpperCase() + "to jest data: " + new Date().valueOf() + "a to data smsa: " + this.smsService.dateMessage + " a to jest data odjeta o 15 min o sysdate: " + (Number(new Date().valueOf()) - 960000));
         switch (true) {
           case (this.smsService.message.toUpperCase() === 'STOP' || this.smsService.message.toUpperCase() === 'START') && !(this.smsService.dateMessage === appSettings.getString('dateMessageOld', '')) && Number(this.smsService.dateMessage) > (Number(new Date().valueOf()) - 960000):
             this.scanAndConnectStop(this.smsService.message.toLowerCase()).then(a => {
               appSettings.setString('dateMessageOld', this.smsService.dateMessage);
               this.smsService.sendSms();
               resolve();
             }, () => { resolve(); console.log("Próba zmiany statusu pompy przez SMS nieudana bo status juz byl nastawiony"); });
             break;
           case this.smsService.message.toUpperCase().startsWith('BOLUS ') && !(this.smsService.dateMessage === appSettings.getString('dateMessageOld', '')) && Number(this.smsService.dateMessage) > (Number(new Date().valueOf()) - 960000):
             console.log("wiadomosc: " + this.smsService.message + "Po okrojeniu:" + this.smsService.message.toUpperCase().match(/BOLUS (\d.\d)/) + "to: " + this.smsService.message.toUpperCase().match(/BOLUS (\d.\d)/)[1]);
             this.scanAndConnectBOL(this.smsService.message.toUpperCase().match(/BOLUS (\d.\d)/)[1].replace(',', '.')).then(() => {
               appSettings.setString('dateMessageOld', this.smsService.dateMessage);
               this.smsService.sendSmsBol(this.smsService.message.toUpperCase().match(/BOLUS (\d.\d)/)[1]);
               resolve();
             }, () => { resolve(); console.log("ciekawe czemu nie poszedl ten pieprzony sms"); });
             break;
           default:
             console.log("Brak komendy do wykonania");
             resolve();
         }
        });
      }
      else {
        resolve();
      }
    });
  }

  scanAndConnectStop(arg){
    return new Promise((resolve, reject) => {
              const timeoutAlert = setTimeout(() => this.errorPumpStan(), 68 * 1000);
                this.pumpBluetoothApiService.sendCommand2("a");
                setTimeout(() => this.pumpBluetoothApiService.read3()
                    .subscribe( dane => {
                      console.log("To jest wynik" + dane);
                      switch (true){
                        case dane.toString().includes("normal") && arg.toString() === 'STOP':
                          console.log("Bede zatrzymywać pompę");
                          this.pumpBluetoothApiService.sendCommand(arg.toString());
                          setTimeout( () => this.pumpBluetoothApiService.read5().subscribe(() => {
                            this.zone.run (() => appSettings.setString("pumpStan", "MAKE RESUME PUMP"));
                            // this.pumpBluetoothApiService.disconnect();
                            clearTimeout(timeoutAlert);
                            resolve();
                          }), 500);
                          break;
                        case dane.toString().includes("suspend") && arg.toString() === 'START':
                          console.log("Bede uruchamiać pompę!");
                          this.pumpBluetoothApiService.sendCommand(arg.toString());
                          setTimeout( () => this.pumpBluetoothApiService.read4().subscribe(() => {
                            this.zone.run (() => appSettings.setString("pumpStan", "MAKE SUSPEND PUMP"));
                            // this.pumpBluetoothApiService.disconnect();
                            clearTimeout(timeoutAlert);
                            resolve();
                          }), 500);
                          break;
                        default:
                          this.smsService.sendBadSms2(dane.toString());
                          clearTimeout(timeoutAlert);
                          reject();
                      }
                    }, () => this.errorPumpStan())
                  , 400);
    })
  }
  scanAndConnectBOL(r) {
    //  this.wakeFacadeService.wakeScreenByCall();
    return new Promise((resolve, reject) => {
              const timeoutAlert = setTimeout(() => this.errorPumpStan(), 80 * 1000);
                this.pumpBluetoothApiService.sendCommand2("X");
                setTimeout(() => this.pumpBluetoothApiService.read3()
                    .subscribe(dane => {
                      console.log("To jest wynik: " + dane + "koniec danych");
                      if (dane.toString().includes("Set bolus")){
                        const d = new Date();
                        d.setMinutes(d.getMinutes() - 6);
                        console.log(" godzina: " + ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2) + " Taki bolus zostal nastawiony: " + r + 'z taka data: ' + new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1 ).toString()).slice(-2).toString());
                        this.pumpBluetoothApiService.sendCommand("BOLUS  " + r);
                        setTimeout(() => this.pumpBluetoothApiService.read6().subscribe(btdane => {
                          const bolhours = btdane.toString().match(/(\d{2}:\d{2})/);
                          if (bolhours !== null && bolhours.length > 1) {
                            console.log("to jest [1] " + bolhours[1] + " a to zero: " + bolhours[0] + "A to po zrzutowaniu do numbera: " + Number(bolhours[1].replace(':', '')));
                            this.bolhour = Number(bolhours[1].replace(':', ''));
                            console.log("Takie cos wyszlo: " + Number(('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2)));
                            console.log("btdane1: !!!!!!!!!!!!! " + this.bolhour + Number(('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2))  + " koniec!!!" + new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1).toString()).slice(-2).toString());
                          }
                          else {
                            this.bolhour = 9999;
                            console.log("Takie cos wyszlo: " + Number(('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2)));
                            console.log("btdane2 : !!!!!!!!!!!!! " + this.bolhour + Number(('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2))  + " koniec!!!" + new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1).toString()).slice(-2).toString());
                          }
                          console.log("btdane: !!!!!!!!!!!!! " + this.bolhour + Number(('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2))  + " koniec!!!" + new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1).toString()).slice(-2).toString());
                          if ((btdane.includes("is delivering") &&  btdane.includes("BL: " + r.toString() + "u")) ||
                            (btdane.includes("is not delivering") &&  btdane.includes("BL: " + r.toString() + "u") && btdane.includes(new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1).toString()).slice(-2).toString()) && this.bolhour > Number(('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2)))){
                            this.successLog(r.toString());
                            clearTimeout(timeoutAlert);
                            resolve();
                          } else {
                            console.log("NO A TERA??:" + btdane.toString());
                            this.smsService.sendBadSms2(btdane.toString().substr(-112));
                            clearTimeout(timeoutAlert);
                            const options = {
                              title: "RESPONSE FROM PUMP:",
                              message: btdane.toString(),
                              okButtonText: "OK"
                            };
                            alert(options);
                            reject();
                          }
                        }), 500);
                      } else
                      {
                        const options = {
                          title: "ERROR RESPONSE FROM PUMP:",
                          message: dane.toString(),
                          okButtonText: "OK"
                        };
                        alert(options);
                        console.log("Poleciał bład ");
                        this.smsService.sendBadSms2(dane.toString());
                        this.pumpBluetoothApiService.disconnect();
                        clearTimeout(timeoutAlert);
                        reject();
                      }
                    }, () => this.errorPumpStan())
                  , 400);
    })
  }

  successLog(r){
    const options = {
      title: "GREAT !",
      message: "Bolus delivered successfully: " + r.toString() + "u" ,
      okButtonText: "OK"
    };
    alert(options);
  }

  setBtConnection() {
    return new Promise((resolve, reject) => {
      this.pumpBluetoothApiService
        .scanAndConnect()
        .then(
          uidBt => {
            if (uidBt === "MED-LINK" || uidBt === "MED-LINK-2" || uidBt === "MED-LINK-3" || uidBt === "HMSoft") {
              console.log(uidBt + "BBBBBBBBBBBBBBBBBBBBB");
              return Promise.resolve(uidBt);
            } else {
              console.log(uidBt + "Nie udalo sie polaczyc booooooo oooooooo status 133");
              return Promise.reject();
            }
          },
          uidBt => {
            console.log("poszedł prawdziwy reject11!!!!!" + uidBt + "       d");
            return this.pumpBluetoothApiService.scanAndConnect().then(
              uidBt2 => {
                if (uidBt === "MED-LINK" || uidBt === "MED-LINK-2" || uidBt === "MED-LINK-3" || uidBt === "HMSoft") {
                  console.log(uidBt2 + "BBBBBBBBBBBBBBBBBBBBB");
                  return Promise.resolve(uidBt2);
                } else {
                  console.log(
                    uidBt2 + "Nie udalo sie polaczyc booooooo oooooooo status 133"
                  );
                  return Promise.reject();
                }
                console.log("XaXaXaXaXa");
              },
              () => {
                console.log("jednak nie udalo sie za 2");
                return Promise.reject();
              }
            );
          }
        )
        .then(
          () =>
            setTimeout(
              () => this.pumpBluetoothApiService.sendCommand("OK+CONN"),
              2500
            ),
          () => {
            console.log("zatem nie wyslam ok kona");
            return Promise.reject(console.log("adam23333333"));

          }
        ).then(() => resolve());
    });
  }
  errorPumpStan(){
    appSettings.setBoolean("isBusy", false);
    appSettings.setString("pumpStan", "CHANGE PUMP STATUS");
    const options = {
      title: "Something was wrong",
      message: "Check pump if everything is OK!",
      okButtonText: "I accept message"
    };
    alert(options);
    this.smsService.sendBadSms();
  }

}
