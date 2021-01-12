import { Injectable, NgZone} from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { IBasicSettings } from "~/app/model/med-link.model";
import { DatabaseService } from "~/app/shared/database.service";
import { SmsService } from "~/app/shared/sms-service";
import { NightscoutApiService } from "~/app/shared/nightscout-api.service";
import { PumpBluetoothApiService } from "~/app/shared/pump-bluetooth-api.service";
import { RawDataService } from "~/app/shared/raw-data-parse.service";
import { WakeFacadeService } from "~/app/shared/wake-facade.service";
import * as appSettings from "application-settings";
import { SmsFacadeService } from '~/app/shared/sms-facade.service';

@Injectable({
  providedIn: "root"
})
export class DataFacadeService {
  btData: string;
  bolhour: number;
  int0: number;
  stanPump: string = "W TRAKCIE...";
  ww = /Rate\s(\d{1}):\s(.\W\d{3})\su\/EX\sfrom\s(\d{2}:\d{2})/g;
  ww2 = /Rate\s(\d{1}):\s(.\W\d{3})\su\/EX\sfrom\s(\d{2}:\d{2})/;
  isf = /Rate\s(\d{1}):\s\s?(\d{2,3})mg.dl\sfrom\s(\d{2}:\d{2})/g;
  isf2 = /Rate\s(\d{1}):\s\s?(\d{2,3})mg.dl\sfrom\s(\d{2}:\d{2})/;
  bgRange = /Rate\s(\d{1}):\s?(\d{2,3}-.\d{2,3})\sfrom\s(\d{2}:\d{2})/g;
  bgRange2 = /Rate\s(\d{1}):\s?(\d{2,3}-.\d{2,3})\sfrom\s(\d{2}:\d{2})/;
  constructor(
    private databaseService: DatabaseService,
    private zone: NgZone,
    private smsFacadeService: SmsFacadeService,
    private smsService: SmsService,
    private nightscoutApiService: NightscoutApiService,
    private pumpBluetoothApiService: PumpBluetoothApiService,
    private rawDataService: RawDataService,
    private wakeFacadeService: WakeFacadeService
  ) {
    this.databaseService.createTable();
  }
  clearInt() {
    clearInterval(appSettings.getNumber('int0'));
  }

  sendDataToLocalDb(pumpStatus: IBasicSettings) {
      return this.databaseService.insertBG(pumpStatus.bloodGlucose);
  }

  sendDataToLocalDb2(pumpStatus: IBasicSettings) {
    return this.databaseService.insertTreatments(pumpStatus.lastBolus);
  }
  sendCalcToLacalDB(pumpStatus: IBasicSettings) {
    return this.databaseService.insertCalc(new Date().toString(), pumpStatus.calc.idVal, pumpStatus.calc.value, pumpStatus.calc.hours, pumpStatus.calc.category);
  }
  sendCalcToLacalDbMax(pumpStatus: IBasicSettings) {
    return this.databaseService.insertCalc(new Date().toString(), 1, pumpStatus.maximumBolusSetting, '00:00', 'max');
  }
  sendCalcToLacalDbstep(pumpStatus: IBasicSettings) {
    return this.databaseService.insertCalc(new Date().toString(), 1, pumpStatus.incrementStepSetting, '00:00', 'step');
  }

  sendDataToLocalDb3(pumpStatus: IBasicSettings) {
    return this.databaseService.insertDeviceStatus(
      pumpStatus.insulinInPompLeft,
      pumpStatus.batteryVoltage,
      pumpStatus.data,
      pumpStatus.statusPump
    );
  }

  sendDataToLocalDb4(pumpStatus: IBasicSettings) {
    return this.databaseService.insertTempBasal(
      pumpStatus.temporaryBasalMethodPercentage.percentsOfBaseBasal,
      pumpStatus.temporaryBasalMethodPercentage.timeLeftInMinutes,
      pumpStatus.temporaryBasalMethodPercentage.timestamp
    );
  }

  getDatafromLocalDb(): Observable<
    Array<{ value: number; date: Date; old: string }>
  > {
    return this.databaseService.getBG().pipe(
      map(rows => {
        return rows.map(a => ({
          value: +a[0],
          date: new Date(a[1]),
          old: this.setArrow(a[3])
        }));
      })
    );
  }

  getDatafromLocalDb2(): Observable<Array<{ value: number; date: Date }>> {
    return this.databaseService.getTreatments().pipe(
      map(rows => {
        return rows.map(a => ({
          value: +a[0],
          date: new Date(a[1])
        }));
      })
    );
  }
  getCalcfromLocalDb(): Observable<Array<{ idVal: number; category: string; dateString: string; value: string; hour: string; }>> {
    return this.databaseService.getCalc().pipe(
      map(rows => {
        return rows.map(a => ({
          idVal: +a[0],
          category: a[1],
          dateString: a[2],
          value: a[3],
          hour: a[4]
        }));
      })
    );
  }

  getDatafromLocalDb3(): Observable<
    Array<{
      reservoir: number;
      voltage: number;
      dateString: Date;
      percent: number;
      status: string;
    }>
  > {
    return this.databaseService.getDS().pipe(
      map(rows => {
        return rows.map(a => ({
          reservoir: +a[0],
          voltage: +a[1],
          dateString: new Date(a[2]),
          percent: +a[3],
          status: a[4]
        }));
      })
    );
  }

  getDatafromLocalDb4(): Observable<
    Array<{ percentsOfBasal: number; minutes: number; dateString: Date }>
  > {
    return this.databaseService.getTempBasal().pipe(
      map(rows => {
        return rows.map(a => ({
          percentsOfBasal: +a[0],
          minutes: +a[1],
          dateString: new Date(a[2])
        }));
      })
    );
  }

  sendDatatoNightscout() {
    return new Promise((resolve, reject) => {
      this.getDatafromLocalDb().subscribe(glucoses => {
        this.nightscoutApiService
          .sendNewBG(glucoses)
          .then(
            successValue => resolve(successValue),
            errorValue => reject(errorValue)
          );
      });
    });
  }

  sendDatatoNightscout2() {
    return new Promise((resolve, reject) => {
      this.getDatafromLocalDb2().subscribe(treatments => {
        this.nightscoutApiService
          .sendNewBol(treatments)
          .then(
            successValue => resolve(successValue),
            errorValue => reject(errorValue)
          );
      });
    });
  }

  sendDatatoNightscout3() {
    return new Promise((resolve, reject) => {
      this.getDatafromLocalDb3().subscribe(deviceStatus => {
        this.nightscoutApiService
          .sendNewDevicestatus(deviceStatus)
          .then(
            successValue => resolve(successValue),
            errorValue => reject(errorValue)
          );
      });
    });
  }
  getDataFromNightscout() {
    this.nightscoutApiService.getBGfromNs().then(svg => {console.log( "TAAAAAAAAAAK2: " + JSON.stringify(svg));
    const obj = JSON.parse(JSON.stringify(svg[0]));
    console.log(obj.sgv, svg[0]);
    this.databaseService.insertBGfromNs(obj.sgv, new Date(obj.dateString), 1);
     // this.databaseService.insertBG(JSON.stringify(svg))
    });
  }

  sendDatatoNightscout4() {
    return new Promise((resolve, reject) => {
      this.getDatafromLocalDb4().subscribe(tempbasal => {
        this.nightscoutApiService
          .sendNewTempBasal(tempbasal)
          .then(
            successValue => resolve(successValue),
            errorValue => reject(errorValue)
          );
      });
    });
  }

  private scanAndConnect() {
      this.pumpBluetoothApiService.scanAndConnect()
        .then(
          uidBt => {
            if (uidBt === "MED-LINK" || uidBt === "MED-LINK-2" || uidBt === "MED-LINK-3" || uidBt === "HMSoft") {
              console.log("Udało połączyć się z: " + uidBt);
              return Promise.resolve(uidBt);
            } else {
              return Promise.reject();
            }
          },
          uidBt => {
            console.log("poszedł prawdziwy reject11!!!!!" + uidBt + "       d");
            return this.pumpBluetoothApiService.scanAndConnect().then(
              uidBt2 => {
                if (uidBt2 === "MED-LINK" || uidBt2 === "MED-LINK-2" || uidBt2 === "MED-LINK-3" || uidBt2 === "HMSoft") {
                  console.log(uidBt2 + "BBBBBBBBBBBBBBBBBBBBB");
                  return Promise.resolve(uidBt2);
                } else {
                  console.log(
                    uidBt2 + "Nie udalo sie polaczyc booo status 133"
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
        )
        .then(
          () => {
            this.waitOnReady();
          },
          () => {
            console.log("zatem nie czekam na ready");
          }
        )

  }
   scanAndConnectStop() {
     return new Promise((resolve, reject) => {
    try {
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
        )
        .then(
          () => {
            const timeoutAlert = setTimeout(() => this.errorPumpStan(), 63 * 1000);
            this.pumpBluetoothApiService.read().subscribe(() => {
              this.pumpBluetoothApiService.sendCommand2("a");
              setTimeout(() => this.pumpBluetoothApiService.read3()
                  .subscribe( dane => {
                    console.log("To jest wynik"+ dane);
                    if (dane.toString().includes("normal")){
                      console.log("STOP POMPA");
                      this.pumpBluetoothApiService.sendCommand("STOP");
                      setTimeout( () => this.pumpBluetoothApiService.read5().subscribe(() => {
                        this.zone.run (() => appSettings.setString("pumpStan", "MAKE RESUME PUMP"));
                       // this.pumpBluetoothApiService.disconnect();
                        clearTimeout(timeoutAlert);
                        resolve();
                      }), 500);
                    } else
                    {
                      console.log("START POMPA!!!");
                      this.pumpBluetoothApiService.sendCommand("START");
                      setTimeout( () => this.pumpBluetoothApiService.read4().subscribe(() => {
                        this.zone.run (() => appSettings.setString("pumpStan", "MAKE SUSPEND PUMP"));
                       // this.pumpBluetoothApiService.disconnect();
                        clearTimeout(timeoutAlert);
                        resolve();
                      }), 500);
                    }
                  }, () => this.errorPumpStan())
                , 400);
            }, () => this.errorPumpStan());
          },
          () => {
            console.log("zatem nie czekam na ready");
            this.errorPumpStan();
            reject();
          }
        )
    } catch {
      console.log("Totalna zsssajebka");
      reject();
    }
  })
  }
  scanAndConnectBOL(r) {
    //  this.wakeFacadeService.wakeScreenByCall();
    return new Promise((resolve, reject) => {
      try {
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
          )
          .then(
            () => {
              const timeoutAlert = setTimeout(() => this.errorPumpStan(), 69 * 1000);
              this.pumpBluetoothApiService.read().subscribe(() => {
                this.pumpBluetoothApiService.sendCommand2("X");
                setTimeout(() => this.pumpBluetoothApiService.read3()
                    .subscribe( dane => {
                      console.log("To jest wynik" + dane + "koniec danych / wyniku");
                      if (dane.toString().includes("Set bolus")){
                        console.log("Taki bolus zostal nastawiony: " + r + 'z taka data: ' + new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1 ).toString()).slice(-2).toString());
                        this.pumpBluetoothApiService.sendCommand("BOLUS  " + r);
                        setTimeout( () => this.pumpBluetoothApiService.read6().subscribe(btdane => {
                          console.log("btdane: !!!!!!!!!!!!!" + btdane.toString() + "koniec!!!" + new Date().getDay().toString() + '-' + new Date().getMonth().toString() );
                          const d = new Date();
                          d.setMinutes(d.getMinutes() - 6);
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
                          //console.log(" godzina: " + ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2) + " Taki bolus zostal nastawiony: " + r + 'z taka data: ' + new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1 ).toString()).slice(-2).toString());
                          if ((btdane.includes("is delivering") &&  btdane.includes("BL: " + r.toString() + "u")) ||
                            (btdane.includes("is not delivering") &&  btdane.includes("BL: " + r.toString() + "u") && btdane.includes(new Date().getDate().toString() + '-' + ('0' + (Number(new Date().getMonth()) + 1).toString()).slice(-2).toString()) && this.bolhour > Number(('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2)))){
                            this.successLog(r.toString());
                            clearTimeout(timeoutAlert);
                          }
                          else {
                            const options = {
                              title: "RESPONSE FROM PUMP:",
                              message: btdane.toString(),
                              okButtonText: "OK"
                            };
                            alert(options);
                          }
                          this.pumpBluetoothApiService.disconnect();
                          clearTimeout(timeoutAlert);
                          resolve();
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
                        this.pumpBluetoothApiService.disconnect();
                        clearTimeout(timeoutAlert);
                        resolve();
                      }
                    }, () => this.errorPumpStan())
                  , 400);
              }, () => this.errorPumpStan());
            },
            () => {
              console.log("zatem nie czekam na ready");
              this.errorPumpStan();
              reject();
            }
          )
      } catch {
        console.log("Totalna zsssajebka");
        reject();
      }
    })
  }
  getCalcData() {
    return new Promise((resolve, reject) => {
      try {
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
          )
          .then(
            () => {
              this.pumpBluetoothApiService.read().subscribe(() => {
                this.pumpBluetoothApiService.sendCommand2("F");
                setTimeout(() => this.pumpBluetoothApiService.read()
                    .subscribe( dane => {
                      const matchDataww =  dane.match(this.ww);
                      const matchDataisf =  dane.match(this.isf);
                      const matchDatabgrange =  dane.match(this.bgRange);
                      console.log("WWWW2" + matchDataww[1], matchDataww.length);
                      console.log("WWWW3" + matchDataisf[1], matchDataisf.length);
                      console.log("WWWW4" + matchDatabgrange[1], matchDatabgrange.length);
                      for(let i = 0; i < Number(matchDataww.length); i++){
                        const adam3 = this.ww2.exec(matchDataww[i]);
                        console.log("To jest wynik:111111 " + adam3.toString());
                        const parsedDate22 = this.rawDataService.parseData(adam3.toString());
                        this.sendCalcToLacalDB(parsedDate22);
                      }
                      for(let i = 0; i < Number(matchDataisf.length); i++){
                        const adam3 = this.isf2.exec(matchDataisf[i]);
                        console.log("To jest wynik:222222 " + adam3.toString());
                        const parsedDate22 = this.rawDataService.parseData(adam3.toString());
                        this.sendCalcToLacalDB(parsedDate22);
                      }
                      for(let i = 0; i < Number(matchDatabgrange.length); i++){
                        const adam3 = this.bgRange2.exec(matchDatabgrange[i]);
                        console.log("To jest wynik:3333333 " + adam3.toString());
                        const parsedDate22 = this.rawDataService.parseData(adam3.toString());
                        this.sendCalcToLacalDB(parsedDate22);
                      }
                      const parsedDate2 = this.rawDataService.parseData(dane);
                      //this.sendCalcToLacalDB(parsedDate2);
                      this.sendCalcToLacalDbMax(parsedDate2);
                      this.sendCalcToLacalDbstep(parsedDate2);
                      const options = {
                        title: "SETTINGS FOR BOLUS WIZARD WAS SAVED IN LOCAL DATABASE",
                        message: dane.toString(),
                        okButtonText: "OK"
                      };
                      alert(options);
                      this.getCalcfromLocalDb().subscribe(d => {
                        console.log(d);
                      });
                      this.pumpBluetoothApiService.disconnect();
                      resolve();
                    }, () => this.errorPumpStan())
                  , 200);
              }, () => this.errorPumpStan());
            },
            () => {
              console.log("zatem nie czekam na ready");
              this.errorPumpStan();
              reject();
            }
          )
      } catch {
        console.log("Totalna zsssajebka");
        reject();
      }
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
  }
  successLog(r){
    const options = {
      title: "GREAT !",
      message: "Bolus delivered successfully: " + r.toString() + "u" ,
      okButtonText: "OK"
    };
    alert(options);
  }

  establishConnectionWithPump() {
    //this.scanAndConnect();
    // setInterval(() => this.scanAndConnect(),  60 * 1000);
    this.wakeFacadeService.setAlarm();
    this.scanAndConnect();
    this.int0 = setInterval(() => this.scanAndConnect(),  5 * 60 * 1000);
    appSettings.setNumber('int0', this.int0);

  }


  waitOnReady() {
    this.pumpBluetoothApiService.read().subscribe(() => {
      this.transferDataFromPumpThenToApi();
    });
  }
  waitOnReadyStop() {
    this.pumpBluetoothApiService.read().subscribe(() => {
     // this.transferDataFromPumpThenToApi();
      this.checStatusPump();
    });
  }
  checStatusPump(){
    setTimeout(() => this.pumpBluetoothApiService.sendCommand2("a"), 400);
    setTimeout(() => this.pumpBluetoothApiService.read3()
        .subscribe( dane => {
          console.log("To jest wynik"+ dane);
          if (dane.toString().includes("normal")){
            console.log("STOP POMPA");
            this.pumpBluetoothApiService.sendCommand("STOP");
            setTimeout( () => this.pumpBluetoothApiService.read3().subscribe(() => {
              this.zone.run (() => this.stanPump = "MAKE SUSPEND PUMP");
              this.pumpBluetoothApiService.disconnect();
            }), 500);
          } else
            {
            console.log("START POMPA!!!");
            this.pumpBluetoothApiService.sendCommand("START");
            setTimeout( () => this.pumpBluetoothApiService.read3().subscribe(() => {
              this.zone.run (() => this.stanPump = "MAKE RESUME PUMP");
              this.pumpBluetoothApiService.disconnect()}), 500);
          }
        })
      , 400);
  }

  preventLowSugar(a: number, b: string) {
    return new Promise((resolve, reject) => {
      if (appSettings.getBoolean('auto', false) && a <= appSettings.getNumber('range', 80) && !(a === 0) && !(a.toString() === '000') && b.toLowerCase().includes('normal')) {
        console.log("AKT WOJNY" + a + b + appSettings.getBoolean('auto', false));
        this.scanAndConnectStop().then(() => {
          console.log("Pompa wyl");
          resolve();
          appSettings.setString("autostop", new Date().toString().substring(3, 21) + "\nWARNING!\nPUMP SUSPENDED BY AUTO STOP FUNCTION\n\n");
        }, () => console.log("BADD ASS nie wylaczona"));
      } else {
        if (appSettings.getBoolean('auto', false) && a > appSettings.getNumber('range', 80) && !(a === 0) && !(a.toString() === '000') && b.toLowerCase().includes('suspend')) {
          console.log("AKT WOJNY3" + a + b);
          this.scanAndConnectStop().then(() => {
            console.log("Pompa wlaczona");
            resolve();
            appSettings.setString("autostop", new Date().toString().substring(3, 21) + "\nWARNING!\nPUMP RESUMED BY AUTO START FUNCTION\n\n");
          }, () => console.log("BADD ASS 2 nie wylaczona"));
        } else {
          console.log("Nie uzywam auto stop/start: " + a + b);
          resolve();
          //NA TESTY TO WYLACZYLEM:
          //this.pumpBluetoothApiService.disconnect();
        }

      }
    })
  }
  validateSms() {
    return new Promise((resolve, reject) => {
      const phoneNumb = appSettings.getString('phoneN', null);
      console.log("to jest numer tel:" + phoneNumb);
      if (phoneNumb !== null && phoneNumb !== 'ENTER PHONE NUMBER') {
        this.smsService.getInboxMessagesFromNumber().then(() => {
          console.log("to jest tresc smsa: " + this.smsService.message.toUpperCase());
          //const dateM = appSettings.getString('dateMessageOld', '');
          console.log("to jest data: " + new Date().valueOf() + "a to data smsa: " + this.smsService.dateMessage + " a to jest data odjeta o 15 min o sysdate: " + (Number(new Date().valueOf()) - 960000));
          if (this.smsService.message.toUpperCase() === 'STOP' && !(this.smsService.dateMessage === appSettings.getString('dateMessageOld', '')) && Number(this.smsService.dateMessage) > (Number(new Date().valueOf()) - 960000)) {
            this.scanAndConnectStop().then(a => {
              appSettings.setString('dateMessageOld', this.smsService.dateMessage);
              this.smsService.sendSms();
              resolve();
            }, () => console.log("Wyslij smutnego smsa"));
          } else {
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
  checkSourceBeforePrevent(parsedDate) {
    return new Promise((resolve, reject) => {
      if (appSettings.getBoolean('bgsource', false) === true) {
        this.nightscoutApiService.getBGfromNs().then(svg => {console.log( "TAAAAAAAAAAK2: " + JSON.stringify(svg));
          const obj = JSON.parse(JSON.stringify(svg[0]));
          console.log(obj.sgv, svg[0]);
          this.databaseService.insertBGfromNs(obj.sgv, new Date(obj.dateString), 1);
          const d = new Date();
          d.setMinutes(d.getMinutes() - 16);
          if (new Date(obj.dateString) > d){
            this.preventLowSugar(obj.sgv, parsedDate.statusPump.toString()).then( () => resolve());
          }
          else {
            console.log("Stary cukier z NS");
            resolve();
          }
        });

      } else {
        this.preventLowSugar(parsedDate.bloodGlucose.value, parsedDate.statusPump.toString()).then( () => resolve());
      }
    });
  }
  transferDataFromPumpThenToApi() {
    setTimeout(() => this.pumpBluetoothApiService.sendCommand2("S"), 400);
    setTimeout(() => {
      this.pumpBluetoothApiService.read2().subscribe(data => {
        console.log('TOOOOO:   ' + data.toString());
        this.btData = data.toString();
        const parsedDate = this.rawDataService.parseData(data);
          this.sendDataToLocalDb(parsedDate)
            .then(() => { console.log('AAAAA doszlo'); this.sendDataToLocalDb2(parsedDate); })
            .then(() => this.sendDataToLocalDb3(parsedDate))
            .then(() => this.sendDataToLocalDb4(parsedDate))
            .then(() => this.sendDatatoNightscout3())
            .then(() => this.databaseService.updateDS())
            .then(() => this.sendDatatoNightscout())
            .then(() => this.databaseService.updateBG())
            .then(() => this.sendDatatoNightscout2())
            .then(() => this.databaseService.updateTreatments())
            .then(() => this.sendDatatoNightscout4())
            .then(() => this.databaseService.updateTempBasal())
            .then(() =>  this.checkSourceBeforePrevent(parsedDate)
              .then(() => this.smsFacadeService.validateSms()
                .then(() => this.pumpBluetoothApiService.disconnect())))
          .catch(error => {
            console.log(error);
            //this.wakeFacadeService.snoozeScreenByCall()
          });
        //this.pumpBluetoothApiService.disconnect();
      });
    }, 400);
  }

  private setArrow(old: string) {
    if (Number(old) >= -5 && Number(old) <= 5) {
      old = "Flat";
    }
    if (Number(old) > 5 && Number(old) < 10) {
      old = "FortyFiveUp";
    }
    if (Number(old) >= 10) {
      old = "SingleUp";
    }
    if (Number(old) < -5 && Number(old) > -10) {
      old = "FortyFiveDown";
    }
    if (Number(old) <= -10) {
      old = "SingleDown";
    }
    return old;
  }
}
