import * as path from './path';
import * as autocomplete from './form/field/auto-complete/auto-complete-field.component';
import 'rxjs/add/operator/map';
import {AutoCompleteFieldEntry} from "./form/field/auto-complete/auto-complete-field-entry";
import {ValueField} from "./form/field/value-field";
import {FieldListField} from "./form/field/fieldList/field-list-field.component";
import {LabelField} from "./form/field/label/label-field.component";
import {IPageElement} from "./pathinterface";
import {RadioGroupField} from "./form/field/radio/radio-group.component";
import {Key} from "./page/element/page-element";
import {KeyUtility} from "./key-utility";
import {FormFunction} from "./form/form-function";
import {TranslationService} from "./service/translation.service";
import {PageLabel} from "./page/element/label/page-label.component";
import {Type} from "@angular/core";
import {CustomContainerPageElement} from "./page/element/custom/custom-container-page-element";
import {CustomPageElement} from "./page/element/custom/custom-container.component";
import {ElementList} from "./page/element/element-list/element-list.component";

export abstract class PathAppComponent implements path.IPathApp {


    private _pageStack:path.Page[] = [];
    private _formStack:path.Form[] = [];
    private _userId:string;
    private _texts:string[]= [];
    private _version:string;

    constructor(private pathService:path.PathService, private translationService:TranslationService) {
        this.pathService.serverGet(this.getBackendUrl(), "/ping", (data:any) => {
            let backendVersion = data["version"];
            if (backendVersion != this.getFrontendVersion()) {
                backendVersion = "Version mismatch: Backend (" + backendVersion + "), Frontend (" + this.getFrontendVersion() + "). Please clear cache or check server installation.";
                window.alert(backendVersion);
            }
            this._version = backendVersion;
            if (data["userId"] != null && data["userId"] != "") {
                this._userId = data["userId"];
                this.setCurrentPage(this.getStartPage(), null);
            }
            if (data["languageCode"] != null && data["languageCode"] != "") {
                sessionStorage.setItem("languageCode", data["languageCode"]);
            }
        }, (err:any) => { console.error(err); });
        this.loadApplicationTexts();
    }

    protected abstract getStartPage():string;

    protected getApplicationLogo():string {
        return null;
    }

    protected abstract getOwnUserForm():string;

    protected abstract getGuiModel();

    protected abstract getBeans();

    protected abstract getHandlers();

    public abstract getBackendUrl():string;

    protected abstract getFrontendVersion():string;

    public isLoading():boolean {
        return this.pathService.isLoading();
    }

    private loadApplicationTexts() {
        this._texts["Logout"] = this.translationService.getText("Logout");
        this._texts["NotSignedIn"] = this.translationService.getText("NotSignedIn");
        this._texts["SignedInAs"] = this.translationService.getText("SignedInAs");
    }

    public getUserId():string {
        return this._userId;
    }

    public login(event, userId:string, password:string) {
        let credentials:any = {};
        credentials["username"] = userId;
        credentials["password"] = password;
        this.pathService.serverPost(this.getBackendUrl(), "/login", credentials, (data:any) => {
            console.log("login ok, language code: " + data["languageCode"] + ", jwt:" + data["jwt"]);
            sessionStorage.setItem("languageCode", data["languageCode"]);
            this._userId = userId;
            this.loadApplicationTexts();
            this.setCurrentPage(this.getStartPage(), null); // set start page
        }, (err:any) => {
            this.pathService.hideLoading();
            alert("Login failed.");
            console.error("failed login");
        });
    }

    public logout() {
        sessionStorage.clear();
        this._userId == null;
        console.log("logout user " + this._userId);
        location.reload();
    }

    public showUserForm() {
        this.setCurrentForm(this.getOwnUserForm(), new Key(0, "userId"), null, null); // TODO set correct key
    }

    public closeCurrentForm() {
        this._formStack.pop();
    }

    public refreshCurrentPage() {
        let refresh: (element:path.PageElement) => void;
        if (this._pageStack[this._pageStack.length - 1].id === this.getStartPage()) {
            // refresh clean, without search text
            refresh = (element:path.PageElement) => {
                let list:path.List = <path.List>element;
                list.filterChanged(null);
                list.refresh(null);
            };
        } else {
            // refresh with search text
            refresh = (element:path.PageElement) => {
                let list:path.List = <path.List>element;
                list.refresh(list.searchText);
            };
        }
        for (let element of this._pageStack[this._pageStack.length - 1].content) {
            if (element instanceof path.List) {
                refresh(element);
            }
        }
        // breadcrumbs
        if (this._pageStack[this._pageStack.length - 2] != null) {
            for (let element of this._pageStack[this._pageStack.length - 2].content) {
                if (element instanceof path.List) {
                    refresh(element);
                }
            }
        }
    }

    public navigateBack() {
        this._pageStack.pop();
        this.refreshCurrentPage();
    }

    public navigateToPage(pageNumber:number) {
        for (let k = this._pageStack.length - 1; k > pageNumber; k--) {
            this.navigateBack();
        }
    }

    public yesNo(text:string, yesHandler : () => void, noHandler : () => void) {
        let form:path.Form = new path.Form(this.pathService, this);
        form.formFunction = new FormFunction();
        form.formFunction.save = (data:any) => {
            this.closeCurrentForm();
            this.refreshCurrentPage();
        };
        form.formFunction.cancel = () => {
            this.closeCurrentForm();
        };
        let message:path.TextField = new path.TextField(form, this.translationService);
        message.type = "label";
        message.visible = true;
        message.labelVisible = false;
        message.setValue(text);
        form.fields.push(message);

        let cancelButton:path.CancelButton = new path.CancelButton(form, this.translationService);
        cancelButton.type = "cancelButton";
        cancelButton.name = this.translationService.getText("Cancel");
        cancelButton.visible = true;
        form.fields.push(cancelButton);

        let okButton:path.OkButton = new path.OkButton(form, this.translationService);
        okButton.type = "okButton";
        okButton.name = this.translationService.getText("Ok");
        okButton.visible = true;
        okButton.handler = {
            doClick(button:path.IButton) {
                yesHandler();
            }
        };
        form.fields.push(okButton);

        form.updateRows();
        this._formStack.push(form);
    }

    protected getCustomComponentClass(componentType:string):Type<CustomPageElement> {
        console.log("Please define a type mapping for " + componentType + " in your App-Component.");
        return null;
    }

    public setCurrentPage(pageId:string, parentPageElement:path.PageElement) {
        let page:path.Page = null;

        for (var modelPage of this.getGuiModel().application.pageList) {
            if (modelPage.id == pageId) {
                page = new path.Page();
                page.id = pageId;
                page.name = this.translationService.getText(modelPage.name);
                if (parentPageElement != null) {
                    page.name = parentPageElement.name;
                }
                for (var modelElement of modelPage.elementList) {
                    this.addPageElement(page, modelElement, parentPageElement);
                }
                page.updateRows();
            }
        }

        if (page == null && pageId != null) {
            this.pathService.addAlert("Missing page", pageId);
        } else {
            this._pageStack.push(page);
        }
    }

    private addPageElement(page: path.Page, modelElement, parentPageElement: path.PageElement) : void {
        let element: path.PageElement = null;
        switch (modelElement.type) {
            case "button":
            case "newButton":
                element = new path.Button(this, this.pathService, this.translationService);
                element.parentPageElement = parentPageElement;
                element.fromJson(modelElement);
                if (modelElement["buttonhandler"] != null) {
                    (<path.Button>element).handler = new (this.getHandlers()[modelElement["buttonhandler"]]);
                }
                break;
            case "deleteButton":
                element = new path.PageDeleteButton(this, this.pathService, this.translationService);
                element.parentPageElement = parentPageElement;
                element.fromJson(modelElement);
                break;
            case "downloadButton": // deprecated
            case "linkButton":
                element = new path.LinkButton(this, this.pathService, this.translationService);
                element.parentPageElement = parentPageElement;
                element.fromJson(modelElement);
                break;
            case "backbutton":
                element = new path.BackButton(this, this.pathService, this.translationService);
                element.fromJson(modelElement);
                break;
            case "inlineForm":
                let inlineForm = new path.InlineForm(this, this.pathService, this.translationService);
                inlineForm.fromJson(modelElement);
                inlineForm.url = KeyUtility.translateUrl(modelElement["url"], inlineForm.getKey(), true, parentPageElement);
                inlineForm.key = parentPageElement != null ? parentPageElement.key : null;
                inlineForm.loadNextForm(true);
                element = inlineForm;
                break;
            case "list":
                let dynamicList: path.List = new path.List(this, this.pathService, this.translationService);
                dynamicList.parentPageElement = parentPageElement;
                dynamicList.fromJson(modelElement);
                // handler
                if (modelElement["handler"] != null) {
                    dynamicList.handler = new (this.getHandlers()[modelElement["handler"]]);
                }
                if (modelElement["buttonhandler"] != null) {
                    dynamicList.buttonHandler = new (this.getHandlers()[modelElement["buttonhandler"]]);
                }
                if (!dynamicList.limit) {
                    dynamicList.refresh(null);
                }
                element = dynamicList;
                break;
            case "ChartElement":
                let chart = new path.ChartElement(this, this.pathService, this.translationService);
                chart.fromJson(modelElement);
                chart.url = KeyUtility.translateUrl(modelElement["url"], null, false, parentPageElement);
                element = chart;
                break;
            case "pageLabel":
                let pageLabel = new PageLabel(this, this.pathService, this.translationService);
                pageLabel.fromJson(modelElement);
                element = pageLabel;
                break;
            case "elementList":
                let elementList = new ElementList(this, this.pathService, this.translationService);
                elementList.fromJson(modelElement);
                let elementListUrl:any = KeyUtility.translateUrl(modelElement["url"], null, false, parentPageElement);
                this.pathService.serverGet(this.getBackendUrl(), elementListUrl, (data:any) => {
                    for (let element of data) {
                        this.addPageElement(page, element, parentPageElement);
                        page.updateRows();
                    }
                }, null);
                element = elementList;
                break;
            default: {
                // call method to get custom component class
                let customContainerPageElement = new CustomContainerPageElement(this);
                customContainerPageElement.fromJson(modelElement);
                customContainerPageElement.typeClass = this.getCustomComponentClass(modelElement.type);
                element = customContainerPageElement;
            }
        }
        if (modelElement["permissionUrl"] != null) {
            element.visible = false;
            let permissionUrl: string = KeyUtility.translateUrl(modelElement["permissionUrl"], null, false, parentPageElement);
            let permissionHandler = (permissionElement: path.PageElement) => (data: any) => {
                permissionElement.visible = data["permission"];
            }
            this.pathService.serverGet(this.getBackendUrl(), permissionUrl, permissionHandler(element), null);
        }
        element.type = modelElement.type;
        element.parentPageElement = parentPageElement;
        page.content.push(element);
    }

    public setCurrentForm(formId:string, key:Key, handler:string, parentPageElement:path.IPageElement) {
        let setCurrentForm = () => {
            // build form function
            let formFunction:FormFunction  = new FormFunction();
            formFunction.save = () => {
                this.closeCurrentForm();
                this.refreshCurrentPage();
            };
            formFunction.cancel = () => {
                this.closeCurrentForm();
            };
            formFunction.delete = () => {
                this.closeCurrentForm();
                let parent:path.IPageElement = parentPageElement;
                if (parent != null && parent instanceof path.PageElement && (<path.PageElement>parent).listElement) {
                    this.refreshCurrentPage();
                } else {
                    this.navigateBack();
                    this.refreshCurrentPage();
                }
            };
            let form:path.Form = this.createForm(formId,key,handler,formFunction, parentPageElement);
            if (form != null) {
                this._formStack.push(form);
            }
        }

        // check permission
        let modelForm = this.getModelForm(formId);
        if (modelForm != null && modelForm["permissionUrl"] != null) {
            let suffix:string = "/update";
            if (key == null) {
                suffix = "/create";
            }
            let permissionUrl:string = KeyUtility.translateUrl(modelForm["permissionUrl"] + suffix, key, false, parentPageElement);
                this.pathService.serverGet(this.getBackendUrl(), permissionUrl, (data:any) => {
                    if (!data["permission"]) {
                        window.alert(this.translationService.getText("NoPermissionError"));
                    } else {
                        setCurrentForm();
                    }
                }, null);
        } else {
            setCurrentForm();
        }
    }

    private getModelForm(formId:string) {
        let result = null;
        for (var modelForm of this.getGuiModel().application.formList) {
            if (modelForm.id === formId) {
                result = modelForm;
            }
        }
        if (result == null && formId != null) {
            this.pathService.addAlert("Missing form", formId);
        }
        return result;
    }

    public createForm(formId:string, key:Key, handler:string, formFunction:FormFunction, parentPageElement:path.IPageElement):path.Form {
        let form:path.Form = null;
        let modelForm = this.getModelForm(formId);
            if (modelForm != null) {
                // create form
                form = new path.Form(this.pathService, this);
                form.fromJson(modelForm);
                form.key = key;
                form.formFunction = formFunction;
                form.title = this.translationService.getText(modelForm.title);
                for (var modelFormField of modelForm.formFieldList) {
                    // create form fields
                    let formField:path.FormField = null;
                    switch (modelFormField.type) {
                        case "text":
                        {
                            formField = new path.TextField(form, this.translationService);
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "translation":
                        {
                            formField = new path.TranslationField(form, this.pathService, this.translationService);
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "number":
                        {
                            formField = new path.NumberField(form, this.translationService);
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "label":
                        {
                            formField = new path.LabelField(form, this.translationService);
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "fieldList":
                        {
                            formField = new path.FieldListField(form, this.translationService);
                            formField.name = "list";
                            formField.fromJson(modelFormField);
                            if (modelFormField["url"] != null) {
                                let fieldListUrl:any = KeyUtility.translateUrl(modelFormField["url"], form.getKey(), false, parentPageElement);
                                let modelId:string = modelFormField["id"];
                                this.pathService.serverGet(this.getBackendUrl(), fieldListUrl, (data:any) => {
                                    let counter:number = 1;
                                    for (let item of data) {
                                        let dynamicField:ValueField<any> = null;
                                        if (item["type"] == "label") {
                                            dynamicField = new LabelField(form, this.translationService);
                                        } else if (item["type"] == "text") {
                                            dynamicField = new path.TextField(form, this.translationService);
                                        } else if (item["type"] == "translation") {
                                            dynamicField = new path.TranslationField(form, this.pathService, this.translationService);
                                        } else if (item["type"] == "number") {
                                            dynamicField = new path.NumberField(form, this.translationService);
                                        }
                                        dynamicField.fromJson(item);
                                        dynamicField.name = item["name"]; // do not use translation service
                                        dynamicField.id = modelId + counter;
                                        (<FieldListField>formField).subfields.push(dynamicField);
                                        counter++;
                                    }
                                    form.updateRows();
                                    (<FieldListField>formField).created = true;
                                }, null);
                            }
                            break;
                        }
                        case "date":
                        {
                            formField = new path.DateField(form, this.translationService);
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "autocomplete":
                        {
                            let autoCompleteFormField = new autocomplete.AutoCompleteField(form, this.translationService, this.pathService);
                            autoCompleteFormField.detailForm = modelFormField["form"];
                            autoCompleteFormField.wordSearchEnabled = modelFormField["wordSearchEnabled"];
                            if (modelFormField["data"] != null) {
                                let data = [];
                                let k:number = 0;
                                for (let item of modelFormField["data"]) {
                                    let entry = new AutoCompleteFieldEntry();
                                    entry.text = item;
                                    entry.key = k;
                                    data.push(entry);
                                    k++;
                                }
                                autoCompleteFormField.data = data;
                                autoCompleteFormField.dataLoaded = true;
                            }
                            else if (modelFormField["url"] != null) {
                                let autoCompleteFormFieldUrl:string = KeyUtility.translateUrl(modelFormField["url"], form.key, false, parentPageElement);
                                autoCompleteFormField.url = autoCompleteFormFieldUrl;
                                autoCompleteFormField.load();
                            }
                            else {
                                autoCompleteFormField.dataLoaded = true;
                            }
                            formField = autoCompleteFormField;
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "RadioGroupField":
                        {
                            let radioGroupFormField = new path.RadioGroupField(form, this.translationService);
                            if (modelFormField["url"] != null) {
                                let radiosUrl:any = KeyUtility.translateUrl(modelFormField["url"], form.getKey(), false, parentPageElement);
                                let radioLoader = (rgField:RadioGroupField) => (data:any) => {
                                    for (let item of data) {
                                        let radio = new path.Radio(form, this.translationService);
                                        radio.name = item["name"];
                                        radio.key = item["key"]["key"].toString(); // force radio key type string for angular2
                                        if (radio.key == item["defaultKey"]) {
                                            rgField.setValue(radio.key);
                                        }
                                        rgField.radios.push(radio);
                                    }
                                    rgField.created = true;
                                    console.log("radio group field created: " + rgField.id);
                                }
                                let radioLoaderForField = radioLoader(radioGroupFormField);
                                this.pathService.serverGet(this.getBackendUrl(), radiosUrl, radioLoaderForField, null);
                            } else {
                                radioGroupFormField.created = true;
                            }
                            radioGroupFormField.fromJson(modelFormField);
                            formField = radioGroupFormField;
                            break;
                        }
                        case "CheckboxGroupField":
                        {
                            let checkboxGroupField = new path.CheckboxGroupField(form, this.translationService);
                            checkboxGroupField.fromJson(modelFormField);
                            formField = checkboxGroupField;
                            break;
                        }
                        case "ProgressBarField":
                        {
                            let progressBarField = new path.ProgressBarField(form, this.translationService);
                            progressBarField.fromJson(modelFormField);
                            formField = progressBarField;
                            break;
                        }
                        case "okButton":
                        {
                            formField = new path.OkButton(form, this.translationService);
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "cancelButton":
                        {
                            formField = new path.CancelButton(form, this.translationService);
                            formField.fromJson(modelFormField);
                            break;
                        }
                        case "deleteButton":
                        {
                            formField = new path.FormDeleteButton(form, this.translationService);
                            formField.fromJson(modelFormField);
                            if (form.key == null) {
                                formField.visible = false;
                            }
                            break;
                        }
                        case "previousButton":
                        {
                            formField = new path.PreviousButton(form, this.translationService);
                            formField.fromJson(modelFormField);
                            if (form.key == null) {
                                formField.visible = false;
                            }
                            break;
                        }
                        default:
                        {
                            formField = new path.FormField(form, this.translationService);
                            formField.fromJson(modelFormField);
                        }
                    }
                    // Field permission (move code to FormField)
                    if (modelFormField["permissionUrl"] != null) {
                        formField.readonly = false;
                        let permissionUrl:string = KeyUtility.translateUrl(modelFormField["permissionUrl"], formField.getForm().getKey(), false, parentPageElement);
                        let permissionHandler = (permissionElement:path.FormField) => (data:any) => {
                            permissionElement.readonly = !data["permission"];
                        }
                        this.pathService.serverGet(formField.getForm().getApp().getBackendUrl(), permissionUrl, permissionHandler(formField), null);
                    }
                    // search parents for defaultKey
                    if (formField instanceof ValueField && modelFormField["defaultKey"] != null) {
                        let pageElement:IPageElement = parentPageElement;
                        while (pageElement != null) {
                            if (pageElement.getKey() != null && pageElement.getKey().getName() == modelFormField["defaultKey"]) {
                                (<ValueField<any>>formField).setValue(pageElement.getKey().getKey());
                                (<ValueField<any>>formField).isInitialValueSet = true;
                                pageElement = null;
                            } else {
                                pageElement = pageElement.getParent();
                            }
                        }
                    }
                    form.fields.push(formField);
                }
                form.updateRows();

                // fetch data from backend
                if (form.url != null && form.key != null) {
                    form.url = KeyUtility.translateUrl(form.url, form.getKey(), true, parentPageElement);
                    this.pathService.serverGet(this.getBackendUrl(), form.url, (data:any) => {
                        for (let field of form.fields) {
                            if (data[field.id] != null && field instanceof path.ValueField) {
                                if (field instanceof RadioGroupField) {
                                    // TODO general solution
                                    let setValueOfRadioGroupFieldContextWrapper = () => {
                                        let f:RadioGroupField = <RadioGroupField>field;
                                        let v:any = data[field.id];
                                        //noinspection TypeScriptUnresolvedFunction
                                        setValueOfRadioGroupField(f, v);
                                    }
                                    let setValueOfRadioGroupField = (radioGroupField:RadioGroupField, value:any) => {
                                        if(!radioGroupField.created) {
                                            console.log("Waiting for RadioGroupField " + radioGroupField.id);
                                            console.log(radioGroupField.created);
                                            window.setTimeout(setValueOfRadioGroupFieldContextWrapper, 50); // wait then try again
                                            return;
                                        }
                                        console.log("setting radiogroupfield value");
                                        if (value != null) {
                                            value = value.toString(); // force radio key type string for angular2
                                        }
                                        radioGroupField.setValue(value);
                                        radioGroupField.isInitialValueSet = true;
                                    }
                                    setValueOfRadioGroupFieldContextWrapper();
                                } else {
                                    (<path.ValueField<any>>field).setValue(data[field.id]);
                                    (<path.ValueField<any>>field).isInitialValueSet = true;
                                }
                            }
                            if (field instanceof FieldListField) {
                                let setValueOfFieldListFieldContextWrapper = () => {
                                    let f:FieldListField = <FieldListField>field;
                                    let d:any = data;
                                    //noinspection TypeScriptUnresolvedFunction
                                    setValueOfFieldListField(f, d);
                                }
                                let setValueOfFieldListField = (fieldListField:FieldListField, value:any) => {
                                    if(!(<FieldListField>field).created) {
                                        console.log("Waiting for FieldListField... ");
                                        setTimeout(setValueOfFieldListFieldContextWrapper, 50); // wait then try again
                                        return;
                                    }
                                    // update fields
                                    for (let subfield of (<FieldListField>field).subfields) {
                                        if (data[subfield.id] != null) {
                                            subfield.setValue(data[subfield.id]);
                                            subfield.isInitialValueSet = true;
                                        }
                                    }
                                }
                                setValueOfFieldListFieldContextWrapper();
                            }
                        }
                    }, null)
                }
                // execute handler
                let handlerName = handler;
                if (handlerName == null) {
                    handlerName = formId + 'Handler';
                }
                if (this.getBeans()[formId] != null && this.getHandlers()[handlerName] != null) {
                    let formBean:path.IForm = new (this.getBeans()[formId]);
                    let formHandler:path.IFormHandler = new (this.getHandlers()[handlerName]);
                    for (let a = 0; a < form.fields.length; a++) {
                        if (form.fields[a].id != null) {
                            formBean[form.fields[a].id] = form.fields[a];
                        }
                    }
                    form.bean = formBean;
                    formHandler.doLoad(form.bean);
                    form.handler = formHandler;
                }
            }
        return form;
    }

    /* toggle navigation
    inspired by: https://angularfirebase.com/lessons/bootstrap-4-collapsable-navbar-work-with-angular */
    show:boolean = false;

    toggleCollapse() {
        this.show = !this.show}




}