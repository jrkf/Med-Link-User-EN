import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import * as Permissions from 'nativescript-permissions';
import { DataFacadeService } from '~/app/shared/data-facade.service';
import { WidgetFacadeService } from '~/app/shared/widget-facade';
import { ForegroundFacadeService } from '~/app/shared/foreground-facade.service';
import { PumpBluetoothApiService } from '~/app/shared/pump-bluetooth-api.service';
import { RawDataService } from '~/app/shared/raw-data-parse.service';
import { DatabaseService } from '~/app/shared/database.service';
import * as appSettings from "application-settings";
import { Switch } from "tns-core-modules/ui/switch";
import { EventData } from "tns-core-modules/data/observable";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { GestureEventData } from "tns-core-modules/ui/gestures";


@Component({
  selector: 'Browse',
  moduleId: module.id,
  templateUrl: './browse.component.html'
})
export class BrowseComponent implements OnInit, OnDestroy {
  lastBgDate: string;
  setBolValStep: number;
  setBolVal: number;
  stepBol: string;
  bgRange: string;
  isf: string;
  tjnaww: string;
  maxBolus: string;
  lastBg: string;
  dateRefresh: string;
  text = '';
  isBusy: boolean = appSettings.getBoolean("isBusy", false);
  output = '';
  uuid: string;
  pumpStan: string;
  pumpData: string;
  items = [];
  bool: boolean = false;
  int0: number;
  interval: number;
  counter: number;
  isCompleted: boolean = appSettings.getBoolean("isCompleted", false);
  bool2: boolean = false;
  interv: number;
  color: string = '#3d5afe';
  stopPeriodPump: number;
  minuta: string;
  godzina: string;
  categoryCheck: string;

  constructor(
    private widgetFacadeService: WidgetFacadeService,
    private zone: NgZone,
    private rawDataParse: RawDataService,
    private fa: DataFacadeService,
    private databaseService: DatabaseService,
    private foregroundUtilService: ForegroundFacadeService,
    private pumpBluetoothApiService: PumpBluetoothApiService,
  ) {
  }

  saveUuid(arg) {
    this.uuid = arg.text.toString().split(',')[1];
    console.log("To jest zapisany UUID:" + this.uuid);
    this.databaseService.insertMAC(this.uuid);
    this.isCompleted = true;
    appSettings.setBoolean("isCompleted", true);
    //this.widgetFacadeService.updateWidget();
  }
  ngOnDestroy(): void {
    clearInterval(appSettings.getNumber('interv'));
  }

  addProfile() {
    dialogs.confirm({
      title: "DO YOU WANT TO ENTER OR DELETE PUMP NUMBER?",
      cancelButtonText: "DELETE",
      okButtonText: "ENTER",
      neutralButtonText: "CANCEL"
    }).then(t => {
        if (t === true) {
          this.addUser();
          appSettings.setBoolean("isBusy", true);
        }
        if (t === false) {
          this.deleteUser();
          appSettings.setBoolean("isBusy", false);
        } else {
          console.log("anulowane wybieranie usera");
        }
      }
    )
  }
  addBolus() {
    dialogs.action({
      title: "SET BOLUS",
      message: "SELECT BOLUS:",
      cancelButtonText: "CANCEL",
      actions: ["EASY BOLUS", "FROM BOLUS WIZARD"],
    }).then(rc => {
      if (rc.toString().includes("EASY BOLUS")) {
        console.log("Dialog closed!" + rc + ", A TO TEKST1:");
        dialogs.prompt({
          title: "SET BOLUS",
          message: "ENTER BOLUS AMOUNT:",
          okButtonText: "OK",
          cancelButtonText: "CANCEL",
          inputType: dialogs.inputType.phone
        }).then(r => {
          if (r.result === true && r.text.match(/(^\d{1}).(\d{1})$/)){
            appSettings.setBoolean("isBusy", true);
            this.fa.scanAndConnectBOL(r.text.replace(',', '.'))
              .then(() => appSettings.setBoolean("isBusy", false),
                () => appSettings.setBoolean("isBusy", false));
          } else {
            const options = {
              title: "NOTE!",
              message: "YOU MUST SET VALUE IN FORMAT: DIGIT.DIGIT",
              okButtonText: "OK"
            };
            alert(options);
          }
          console.log("Dialog closed!" + r.result + ", A TO TEKST2sdfsdfsdfsdfsdfsdfsdfsdfsd:" + r.text.replace(',', '.'));
        });
      }
      if (rc.toString().includes("FROM BOLUS WIZARD")) {
        console.log("Dialog closed!" + rc + ", A TO TEKST1:");
        this.fa.getCalcfromLocalDb().subscribe(category => {
          this.categoryCheck = category.toString();
          console.log("ten" + this.categoryCheck + "napis");
          this.maxBolus = category[0].value;
          this.dateRefresh = category[0].dateString;
        });
        if (this.categoryCheck !== '') {

        this.databaseService.getCalcisf().subscribe(a => this.isf = a[0][3]);
        this.databaseService.getCalcjnaww().subscribe(a => this.tjnaww = a);
        this.databaseService.getCalcStep().subscribe(a => this.stepBol = a);
        this.databaseService.getCalcBgRange().subscribe(a => this.bgRange = a.toString());
        this.databaseService.getLastBg15().subscribe(bg => {
          //bg.toString().split('-')[0];
          console.log("Sugar: " , bg.toString().split(',')[0]);
          this.lastBg = bg.toString().split(',')[0];
          this.lastBgDate = bg.toString().split(',')[1];
          if (this.lastBg.length < 1 && this.bgRange.length >= 1){
            console.log("shuga:" + this.lastBg);
            //srednia z bg range
            this.lastBg = ((Number(this.bgRange.split('-')[0].trim()) + Number(this.bgRange.split('-')[1].trim())) / 2).toString();
            this.lastBgDate = '\nNO BG FROM THE LAST 15 MINS!'
          }
          else {
            console.log("Brak informacji o cukrze z 15 min i kalkulatorze bolusa")
          }
        });

        dialogs.prompt({
          title: "SET BOLUS",
          message: "WARNING! BOLUS WIZARD DOES NOT INCLUDE AN ACTIVE IOB" + "\n\nENTER THE AMOUNT OF CARBS IN GRAMS: ",
          okButtonText: "OK",
          cancelable: false,
          cancelButtonText: "CANCEL",
          inputType: dialogs.inputType.number
        }).then(r => {
          if(r.result === true && this.maxBolus.length > 0){
          console.log(this.bgRange.split('-')[0]);
          this.setBolVal = (Number(r.text) / 10 * Number(this.tjnaww)) + (Number(this.lastBg) - (Number(this.bgRange.split('-')[0].trim()) + Number(this.bgRange.split('-')[1].trim())) / 2) / Number(this.isf);
          this.setBolValStep = Math.round(this.setBolVal / Number(this.stepBol)) * Number(this.stepBol);
          console.log("setBolValStep" , Math.round(this.setBolVal / Number(this.stepBol)) * Number(this.stepBol));
            dialogs.prompt({
            title: "SET BOLUS",
            message: "\nLast BG: " + this.lastBg + ' ' + this.lastBgDate + "\nRefreshed settings: " + this.dateRefresh.substring(3, 21) + "\nCarb ratios in EXCH: " + this.tjnaww + "\nInsulin sensitivities: " + this.isf + "\nBG tergets: " + this.bgRange + "\nEasy bolus step: " + this.stepBol + "\nMax. bolus: " + this.maxBolus + "\nSuggested bolus: " + this.setBolVal.toFixed(1) + "\nSuggested bolus from wizard with bolus step compliance: ",
            okButtonText: "OK",
            defaultText: this.setBolValStep.toFixed(1).toString(),
            cancelButtonText: "CANCEL",
            inputType: dialogs.inputType.phone
          }).then(rr => {
            if (rr.result === true && rr.text.match(/(^\d{1}).(\d{1})$/) && Number(rr.text) <= Number(this.maxBolus)) {
              appSettings.setBoolean("isBusy", true);
              this.fa.scanAndConnectBOL(rr.text.replace(',', '.'))
                .then(() => appSettings.setBoolean("isBusy", false),
                  () => appSettings.setBoolean("isBusy", false));
            } else {
              const options = {
                title: "NOTE!",
                message: "YOU MUST SET VALUE IN FORMAT: DIGIT.DIGIT\n WHICH IS LESS THAN MAX. BOLUS",
                okButtonText: "OK"
              };
              alert(options);
            }
            console.log("Dialog closed!" + r.result + ", A TO TEKST2sdfsdfsdfsdfsdfsdfsdfsdfsd:" + r.text.replace(',', '.'));
          });
          }
        });
      }
      else {
          const options = {
            title: "NO CURRENT DATA FOR BOLUS WIZARD SETTINGS",
            message: "PLEASE SET FROM MENU 'REFRESH BOLUS WIZARD SETTINGS'",
            okButtonText: "OK"
          };
          alert(options);
        }}
    });
  }


  refreshCalc() {
    dialogs.confirm({
      title: "DATA FOR BOLUS WIZARD WILL BE READ FROM PUMP",
      message: "This will be data as: BG targets, insulin sensitivities, carb ratios, max. bolus value, easy bolus step",
      okButtonText: "OK",
    }).then( () => {
      appSettings.setBoolean("isBusy", true);
	  console.log("Tu jeszcze dolecialo");
      this.fa.getCalcData().then(() => appSettings.setBoolean("isBusy", false), () => appSettings.setBoolean("isBusy", false));
    });
  }

  addUser() {
    this.pumpBluetoothApiService.scanAndConnect().then(() => this.pumpBluetoothApiService.read2().subscribe(() =>
      dialogs.prompt({
        title: "ENTER PUMP NUMBER",
        message: "YOUR PUMP NUMBER IS:",
        okButtonText: "OK",
        cancelButtonText: "CANCEL",
        inputType: dialogs.inputType.number
      }).then(r => {
        console.log("Dialog closed!" + r.result + ", A TO TEKST:" + r.text);
        this.pumpBluetoothApiService.sendCommand3(r.text);
      }).then(() => this.pumpBluetoothApiService.read2().subscribe(() =>
        dialogs.prompt({
          title: "IMIĘ I NAZWISKO",
          message: "Podaj imię i nazwisko",
          okButtonText: "OK",
          cancelButtonText: "Anuluj",
          inputType: dialogs.inputType.text
        }).then(rr => {
            this.pumpBluetoothApiService.sendCommand3(rr.text);
            this.zone.run(() => appSettings.setBoolean("isBusy", false));
          }
        )))
    ));
  }
  onLongPress(args: GestureEventData) {
    if (this.pumpStan === "MAKE SUSPEND PUMP"){
      dialogs.action({
        title: "MAKE SUSPEND PUMP FOR TIME: ",
        cancelButtonText: "CANCEL",
        actions: ["10 MIN", "15 MIN", "20 MIN", "30 MIN", "60 MIN"]
      }).then(r => {
        if(r.toString() !== 'CANCEL') {
          console.log("Evsent name: " + args.eventName + r.length + "asdasd    " + r.toString());

          appSettings.setBoolean("isBusy", true);
          appSettings.setString("pumpStan", "PLEASE WAIT...");
          this.fa.scanAndConnectStop().then(() => this.zone.run(() =>
            {
              const date = new Date();
              date.setMinutes(date.getMinutes() + parseInt(r.toString().substring(0, 2), 10));
              this.minuta = date.getMinutes().toString();
              if(date.getMinutes() < 10){
                this.minuta = '0' + this.minuta;
              }
              this.godzina = date.getHours().toString();
              if(date.getHours() < 10){
                this.godzina = '0' + this.godzina;
              }
              const czas = this.godzina + ":" + this.minuta;
              appSettings.setString('pumpStan', "SCHEDULED AUTO-RESUME PUMP ABOUT  " + czas);
              this.stopPeriodPump = setTimeout(() => this.stopCommon(), 1000 * 60 * parseInt(r.toString().substring(0, 2), 10));
              appSettings.setNumber('stopPeriodPump', this.stopPeriodPump);
              appSettings.setBoolean("isBusy", false);
            }
          ), () => {
            this.zone.run(() => {
              appSettings.setBoolean("isBusy", false);
              this.pumpStan = "Something was wrong";
            })
          });

        }
      });
    }
    else { if(this.pumpStan.toString().includes("WZNOWIENIE")) {
      dialogs.confirm({
        title: "Do you want to cancel a later AUTO-RESUME of the pump?",
        message: "The pump must be resumed manually",
        okButtonText: "OK",
        cancelButtonText: "CANCEL"
      }).then(r => {
          if (r) {
            console.log("AAAAAAAAAAAAAAAA");
            clearTimeout(appSettings.getNumber('stopPeriodPump'));
            appSettings.setString('pumpStan', 'MAKE RESUME PUMP');
            appSettings.setBoolean("isBusy", false);
          }
        }
      );
    }

    }
  }

  deleteUser() {
    this.pumpBluetoothApiService.scanAndConnect().then(() => this.pumpBluetoothApiService.read2().subscribe(() =>
      dialogs.confirm({
        title: "DELETE PUMP USER",
        message: "ARE YOU SURE TO DELETE YOUR PUMP NUMBER?",
        okButtonText: "OK",
        cancelButtonText: "CANCEL"
      }).then(r => {
        if (r) {
          this.pumpBluetoothApiService.sendCommand3("DELETE");
          //this.isBusy = false;
        }
      })
    ));
  }

  onCheckedChange(args: EventData) {
    const mySwitch = args.object as Switch;
    const isChecked = mySwitch.checked; // boolean
    if (isChecked === true) {
      dialogs.confirm({
        title: "Statement",
        message: "I agree and acknowledge that:\n" +
          "1) The product is not an approved medical device, it is only a research\n" +
          "and support tool for patients with diabetes;\n" +
          "2) The Product is made available and used solely for information \n" +
          "and training purposes;\n" +
          "3) The product is provided without warranty of any kind (expressed or implied);\n" +
          "4) The software contained in the Product operates under an open source license,\n" +
          "and the use of the Product does not require any fees or remuneration,\n" +
          "including for the benefit of entities entitled to the software;\n" +
          "5) The software included in the Product has not been approved by any manufacturer;\n" +
          "6) The product may not work continuously, on time, safely and without errors;\n" +
          "7) The product may not work with other software or other hardware;\n" +
          "8) The results obtained in connection with the use of the Product may not be accurate and reliable;\n" +
          "9) I don't have any property rights or shares in the Product;\n" +
          "10) I will use the Product only at my own risk and responsibility;\n" +
          "11) I will use the Product only for my personal use;\n" +
          "12) I will not use or rely on the Product to make any medical decisions, \n" +
          "decisions related to treatment, and I will not use the Product as\n" +
          "a substitute for professional medical care;\n" +
          "13) I undertake to bear all the costs of the Product repair or service.\n" +
          "Additionally, declares that I will not pursue any claims against the authors of the\n" +
          "Product for improper operation or use of the Product, including, in particular,\n" +
          "I will not pursue claims for damages resulting from:\n" +
          "1) Improper use of the Product;\n" +
          "2) Lack of efficiency or reduced efficiency of the Product, errors and damage to the Product,\n" +
          "delays in its operation;\n" +
          "3) Failure to comply with the rules of the Product's operation;\n"+
          "4) Improper storage of the Product;\n" +
          "5) Failure to protect the Product against damage or destruction of the Product;\n" +
          "6) Discharge of the Product or other connected equipment;\n" +
          "7) Problems with other equipment connected to the Product;\n" +
          "8) Communication problems between the Product and other connected equipment.\n",
        okButtonText: "I confirm",
        cancelButtonText: "Cancel"
      }).then(result => {
        if (result === true) {
          this.setPermissions();
          this.databaseService.insertStan(true);
        } else {
          mySwitch.checked = false;
          this.databaseService.insertStan(false);
        }
      }, () => console.log("MAM CIE"));

    } else {
      this.foregroundUtilService.stopForeground();
      this.databaseService.insertStan(false);
    }
  }
  changeColorButton(){
    if (this.pumpStan === "MAKE RESUME PUMP")
    {
      this.color = 'GREEN'
    } else {
      if (this.pumpStan === "MAKE SUSPEND PUMP") {
        this.color = 'RED'
      } else {
        this.color = '#3d5afe'
      }
    }
  }
  stopCommon(){
    clearTimeout(appSettings.getNumber('stopPeriodPump'));
    appSettings.setBoolean("isBusy", true);
    appSettings.setString("pumpStan", "PLEASE WAIT...");
    this.fa.scanAndConnectStop().then(() => this.zone.run(() =>
      {
        this.pumpStan = appSettings.getString("pumpStan", "CHANGE PUMP STATUS");
        appSettings.setBoolean("isBusy", false);
      }
    ), () => {
      this.zone.run(() => {
        appSettings.setBoolean("isBusy", false);
        this.pumpStan = "Check the pump. Something was wrong";
      })
    });
  }
  stop() {
    dialogs.confirm({
      title: "Are you sure to change the pump status?",
      okButtonText: "Yes",
      cancelButtonText: "No"
    }).then(t => {
      if (t === true) {
     this.stopCommon();
      } else {
        appSettings.setBoolean("isBusy", false);
      }
    }).then(() => console.log("CIEKAWE MIESJCE !@EWDSFSRER"))
  }

  scan() {
    //this.fa.getDataFromNightscout();
    this.bool = appSettings.getBoolean("someBoolean", false);
    appSettings.setBoolean("someBoolean", this.bool);
    Permissions.requestPermission(
      android.Manifest.permission.ACCESS_COARSE_LOCATION
    ).then(() =>
      this.pumpBluetoothApiService.scanAndConnect2().subscribe(a => {
        console.log("TO Jest Wynik skanowania: " + this.pumpBluetoothApiService.targetBluDeviceUUID + a);
        this.items = this.pumpBluetoothApiService.targetBluDeviceUUID2;
      }));
  }
  setPermissions() {
    Permissions.requestPermission(
      android.Manifest.permission.ACCESS_COARSE_LOCATION
    )
      .then(() =>
        Permissions.requestPermission(android.Manifest.permission.BLUETOOTH)
      )
      .then(() =>
        Permissions.requestPermission(
          android.Manifest.permission.BLUETOOTH_ADMIN
        )
      )
      .then(() =>
        Permissions.requestPermission(
          android.Manifest.permission.WAKE_LOCK
        )
      )
      .then(() => Permissions.requestPermission(
        android.Manifest.permission.WRITE_SETTINGS
      ))
      .then(() => {
        this.pumpBluetoothApiService.enable();
        try {
          this.foregroundUtilService.startForeground();
        } catch (e) {
          console.error(e);

          this.foregroundUtilService.stopForeground();
        }
      });
  }
  execSQL(){
    this.databaseService.execSQLSuccessMonitor.subscribe(wynik => {
      this.pumpData = this.fa.btData;
      console.log("%%%%%%%%%%%%%%%%%%%%%%           :" + this.fa.btData);
      appSettings.setString("pumpData", this.fa.btData);
      this.foregroundUtilService.updateForeground();
      if (wynik.toString().endsWith('suspend') && !appSettings.getString('pumpStan', "CHANGE PUMP STATUS").toString().includes("WZNOWIENIE")){
        this.zone.run (() =>
        {
          appSettings.setString("pumpStan", "MAKE RESUME PUMP");
          this.pumpStan = appSettings.getString("pumpStan");
          this.changeColorButton();
          console.log("ANO MAMY POMPE ZAWIESZONA: " + wynik.toString().endsWith('suspend') + this.pumpStan);
        });

      }
      if (wynik.toString().endsWith('normal'))
      {
        this.zone.run (() => {
          appSettings.setString("pumpStan", "MAKE SUSPEND PUMP");
          this.pumpStan = appSettings.getString("pumpStan");
          this.changeColorButton();
          clearTimeout(appSettings.getNumber('stopPeriodPump'));
          console.log("ANO MAMY POMPE URUCHOMIONA: " + wynik.toString().endsWith('normal') + this.pumpStan);
        });
      }
    });
  }

  ngOnInit(): void {
    clearInterval(appSettings.getNumber(("interv")));
    this.interv = setInterval(() => {
      this.uuid = appSettings.getString("counter");
      this.pumpData = appSettings.getString("autostop", "") + appSettings.getString("pumpData", '');
      this.pumpStan = appSettings.getString("pumpStan", "CHANGE PUMP STATUS");
      this.isBusy = appSettings.getBoolean("isBusy");
      //console.log("551");
      this.changeColorButton();
    }, 1000);
    appSettings.setNumber('interv', this.interv);


     this.databaseService.getStan().subscribe(wynik => {
       this.bool2 = wynik.toString().toLowerCase() === 'true';
     });
    this.execSQL();
  }
}
