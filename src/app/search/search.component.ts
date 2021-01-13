import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { compose } from 'nativescript-email';
import * as Permissions from 'nativescript-permissions';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataFacadeService } from '~/app/shared/data-facade.service';
import { DatabaseService } from '~/app/shared/database.service';
import { TraceWriterService } from '~/app/shared/trace-writer.service';
import Runtime = java.lang.Runtime;
import * as fs from "tns-core-modules/file-system";
import { EventData } from "tns-core-modules/data/observable";
import { Switch } from "tns-core-modules/ui/switch";
import * as appSettings from "tns-core-modules/application-settings";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { toNumbers } from "@angular/compiler-cli/src/diagnostics/typescript_version";

@Component({
  selector: "Search",
  moduleId: module.id,
  templateUrl: "./search.component.html",
  styleUrls: ["./search.component.scss"]
})
export class SearchComponent implements OnInit {
  slowo: string;
  slowo2: string;
  nsUrl: string;
  nsUrl2: string;
  nsKey: string;
  phoneN: string;
  //phone: string = '';
  nsKey2: string;
  carbs: string;
  pending = false;
  aReduced2: string;
  auto: boolean;
  bgSource: boolean;
  range: number;
  rangeText: string = "AUTO STOP AT BG VALUE: " + appSettings.getNumber('range', 80);

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private databaseService: DatabaseService,
    private dataFacadeService: DataFacadeService,
    private traceWriterService: TraceWriterService
  ) {
    // Use the constructor to inject services.
  }
  ngOnInit(): void {
    this.phoneN = 'PHONE: ' + appSettings.getString('phoneN', 'ENTER PHONE NUMBER');
    this.auto = appSettings.getBoolean('auto', false);
    this.bgSource = appSettings.getBoolean('bgsource', false);
    this.rangeText = "AUTO STOP AT BG VALUE: " + appSettings.getNumber('range', 80) + " MG/DL";
    this.traceWriterService.subscribe(
      ({ message, date, category, messageType }) => {
        this.databaseService.insertLogs(date, message, messageType, category);
      }
    );
    this.sendDatatoNightscout7().then(() =>
      console.log(this.nsUrl2 + "fffffffff3333333f")
    );
  }
  getBGRange(){
    dialogs.prompt({
      title: "ENTER LIMIT BG VALUE TO SUSPEND PUMP",
      message: "LIMIT BG VALUE IS:",
      okButtonText: "OK",
      cancelButtonText: "CANCEL",
      inputType: dialogs.inputType.number
    }).then(r => {
      console.log("Dialog closed!" + r.result + ", A TO TEKST:" + r.text);
      this.range = Number(r.text);
      if(this.range < 80 || this.range > 120){
 dialogs.alert({message: "BG VALUE OUT OF ACCEPTABLE RANGE: 80 - 120 mg/dl", okButtonText: "OK"});
      }
      else {
        appSettings.setNumber('range', this.range);
        this.rangeText = "AUTO STOP AT BG VALUE: " + this.range + " MG/DL";
      }

    });
}
  setPhoneNumber(){
    dialogs.prompt({
      title: "ENTER PHONE NUMBER",
      message: "Enter parent or guardian phone number for remote SMS commands: START, STOP, BOLUS",
      okButtonText: "OK",
      cancelButtonText: "CANCEL",
      inputType: dialogs.inputType.number
    }).then(r => {
      console.log("Dialog closed!" + r.result + ", A TO TEKST:" + r.text);
      if (r.text === '') {
        appSettings.setString('phoneN', 'ENTER PHONE NUMBER');
        this.phoneN = 'ENTER PHONE NUMBER';
      }
      else {
        Permissions.requestPermission(
          android.Manifest.permission.SEND_SMS, "zezwolic na czytanie SMS?"
        ).then(() => Permissions.requestPermission(android.Manifest.permission.READ_SMS));
        appSettings.setString('phoneN', r.text);
        this.phoneN = 'PHONE: ' + r.text;
      }
    });
  }

  sendLogs() {
    const documents = fs.path.join(android.os.Environment.getExternalStorageDirectory().getAbsolutePath().toString());
    const myFolder = fs.Folder.fromPath(documents);
    const myFile = myFolder.getFile("my.txt");
    const a = Runtime.getRuntime().exec('logcat -v time -f /sdcard/my.txt -d');
    console.log("to ta wielkosc pliku: " + myFile.size);
    if (myFile.size > 2000000 )
    {
      myFile.remove();
    }

    const u = setInterval( () => {
    if (a.isAlive() === false){
      clearInterval(u);
      console.log("CIOSs");
      Permissions.requestPermission(
        android.Manifest.permission.WRITE_EXTERNAL_STORAGE,
      ).then(() =>
        compose({
          subject: "Debug med-link-ui",
          body: "aReduced2",
          to: ["jrkf@o2.pl"],
                    attachments:
                      [{
                        mimeType: 'text',
                        path: myFile.path,
                        fileName: 'my.txt'
                      }]
        })
      )
    }
    else {
      console.log("BAM BAM");
    }
    }, 500);
  }

  Zapisz() {
    console.log("aaaaaa" + this.nsUrl);
    const sha1 = require("sha1");
    this.databaseService.insertNS(this.nsUrl, sha1(this.nsKey), this.nsKey);
    console.log("NS URL: " + this.nsUrl + " ddddddddddd " + this.nsKey);
    this.sendDatatoNightscout6().then(() =>
      console.log(this.slowo + "aRRRRRRRRRR")
    );
    if (
      this.nsUrl.substring(0, 4).toUpperCase() !== "HTTP" ||
      this.nsUrl.substring(this.nsUrl.length - 1, this.nsUrl.length) === "/"
    ) {
      this.slowo2 = "INCORRECT URL!";
    } else {
      this.slowo2 = "OK! ";
    }
  }
  onCheckedChangeAuto(args: EventData) {
    const mySwitch = args.object as Switch;
    const isChecked = mySwitch.checked; // boolean
    if (isChecked === true) {
       appSettings.setBoolean("auto", true);
      this.auto = appSettings.getBoolean('auto');
    }
    else {
      appSettings.setBoolean("auto", false);
      this.auto = appSettings.getBoolean('auto');
    }
    }
  onCheckedChangeSource(args: EventData) {
    const mySwitch = args.object as Switch;
    const isChecked = mySwitch.checked; // boolean
    if (isChecked === true) {
      appSettings.setBoolean("bgsource", true);
      this.bgSource = appSettings.getBoolean('bgsource');
    }
    else {
      appSettings.setBoolean("bgsource", false);
      this.bgSource = appSettings.getBoolean('bgsource');
    }
  }
  sendDatatoNightscout6() {
    return new Promise((resolve, reject) => {
      this.getNSData().subscribe(g => {
        g.map(bol => {
          console.log(bol.http.toString() + "JJJJJJJ" + bol.secret.toString());
          this.slowo =
            this.slowo2 +
            "  " +
            bol.http.toString() +
            " " +
            bol.secret.toString();
        });
        console.log("as" + this.slowo);
        resolve(), reject();
      });
    });
  }
  sendDatatoNightscout7() {
    return new Promise((resolve, reject) => {
      this.getNSData().subscribe(g => {
        g.map(bol => {
          console.log(
            bol.http.toString() + "66666666666" + bol.secret.toString()
          );
          this.nsUrl2 = bol.http.toString();
          this.nsKey2 = bol.hash.toString();
        });
        console.log("as" + this.nsUrl2);
        resolve(), reject();
      });
    });
  }
  setNS(arg) {
    console.log("setttNS");
    console.log(arg.text);
    this.nsUrl = arg.text;
  }
  setNSurl(arg) {
    console.log("setttNSUURRL");
    console.log(arg.text);
    this.nsKey = arg.text;
  }
  getNSData(): Observable<
    Array<{ http: string; secret: string; hash: string }>
  > {
    return this.databaseService.NSconf().pipe(
      map(rows => {
        return rows.map(a => ({
          http: a[0],
          secret: a[1],
          hash: a[2]
        }));
      })
    );
  }
}
