import {PageElement} from './../../page/element/page-element';
import {Action} from './../../form/field/button/action';
import {IFormField, IPathApp} from "../../pathinterface";

export class FormField extends PageElement implements IFormField{
    private _height:number;
    private _width:number;
    private _newRow:boolean;
    private _visible:boolean;
    private _mandatory:boolean;
    private _actions:Action[] = [];

    public getApp():IPathApp {
        return this.app;
    }

    get actions():Action[] {
        return this._actions;
    }

    set actions(value:Action[]) {
        this._actions = value;
    }

    get height():number {
        return this._height;
    }

    set height(value:number) {
        this._height = value;
    }

    get visible():boolean {
        return this._visible;
    }

    set visible(value:boolean) {
        this._visible = value;
    }

    get width():number {
        return this._width;
    }

    set width(value:number) {
        this._width = value;
    }

    get newRow():boolean {
        return this._newRow;
    }

    set newRow(value:boolean) {
        this._newRow = value;
    }

    get mandatory():boolean {
        return this._mandatory;
    }

    set mandatory(value:boolean) {
        this._mandatory = value;
    }

    public fromJson(modelFormField) {
        this.visible = true;
        if (modelFormField["visible"] != null) {
            this.visible = modelFormField["visible"];
        }
        this.width = 1;
        if (modelFormField["width"] != null) {
            this.width = modelFormField["width"];
        }
        this.newRow = false;
        if (modelFormField["newRow"] != null) {
            this.newRow = modelFormField["newRow"];
        }
        this.mandatory = false;
        if (modelFormField["mandatory"] != null) {
            this.mandatory = modelFormField["mandatory"];
        }
        this.id = modelFormField["id"];
        this.name = modelFormField.name;
        this.type = modelFormField.type;
        this.height = modelFormField["height"];
    }
}