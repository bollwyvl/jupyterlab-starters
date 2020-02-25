import { Widget } from '@phosphor/widgets';
import { JSONExt } from '@phosphor/coreutils';
import { IIterator } from '@phosphor/algorithm';
import { PathExt, URLExt } from '@jupyterlab/coreutils';
import { ALL_CUSTOM_UI } from '../fields';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget
} from '@jupyterlab/docregistry';

import { Toolbar } from '@jupyterlab/apputils';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { SchemaForm } from '../schemaform';

import { SchemaFinder, Indenter } from './toolbar';

// TODO: make configurable/detectable
export const INDENT = 2;
export const DOC_CLASS = 'jp-SchemaForm-Document';

export class JSONSchemaFormDocument extends DocumentWidget<Widget> {
  content: SchemaForm;
  docManager: IDocumentManager;
  getOpenWidgets: () => IIterator<Widget>;
  private _schemaModel: DocumentRegistry.IModel;
  private _uiSchemaModel: DocumentRegistry.IModel;
  private _schemaId: string;
  private _schemaFinder: SchemaFinder;
  private _uiSchemaFinder: SchemaFinder;
  private _indenter: Indenter;

  constructor(options: JSONSchemaFormDocument.IOptions) {
    super(options);
    this.addClass(DOC_CLASS);
    this.docManager = options.docManager;
    this.getOpenWidgets = options.getOpenWidgets;

    const { context } = options;
    this.initToolbar();

    this.content.model.stateChanged.connect(this.onFormChange, this);

    context.ready
      .then(async () => await this.onContextReady())
      .catch(console.warn);
  }

  dispose() {
    if (this.isDisposed) {
      return;
    }
    this.content.model.stateChanged.disconnect(this.onFormChange, this);
    this.context.model.contentChanged.disconnect(this.onContentChanged, this);
    if (this.schemaModel) {
      this.schemaModel.contentChanged.disconnect(this.onSchema, this);
    }
    super.dispose();
  }

  /**
   * TODO:
   * - manual schema selection
   * - text formatting options: indent, sortkeys, etc
   */
  initToolbar() {
    this._schemaFinder = new SchemaFinder();
    this._schemaFinder.model.label = 'JSON';
    this._schemaFinder.model.getOpenWidgets = this.getOpenWidgets;
    this._schemaFinder.model.stateChanged.connect(this.onSchemaFound, this);

    this._uiSchemaFinder = new SchemaFinder();
    this._uiSchemaFinder.model.label = 'UI';
    this._uiSchemaFinder.model.getOpenWidgets = this.getOpenWidgets;
    this._uiSchemaFinder.model.stateChanged.connect(this.onUiSchemaFound, this);

    this._indenter = new Indenter();
    this._indenter.model.stateChanged.connect(this.onFormChange, this);

    this.toolbar.addItem('schema', this._schemaFinder);
    this.toolbar.addItem('ui', this._uiSchemaFinder);
    this.toolbar.addItem('spacer', Toolbar.createSpacerItem());
    this.toolbar.addItem('indenter', this._indenter);
  }

  async onFormChange() {
    this.context.model.fromString(
      JSON.stringify(
        this.content.model.formData,
        null,
        this._indenter.model.indent
      )
    );
  }

  async onSchemaFound() {
    const model = this._schemaFinder.model.schemaContext?.model;
    if (
      model != null &&
      model !== this.schemaModel &&
      model !== this.context.model
    ) {
      this._schemaId = null;
      this.schemaModel = model;
    }
  }

  async onUiSchemaFound() {
    const model = this._uiSchemaFinder.model.schemaContext?.model;
    if (
      model != null &&
      model !== this.uiSchemaModel &&
      model !== this.context.model
    ) {
      this.uiSchemaModel = model;
    }
  }

  async onContextReady() {
    this.context.model.contentChanged.connect(this.onContentChanged, this);
    this.context.pathChanged.connect(this.onPathChanged, this);
    this.onContentChanged();
    this.onPathChanged();
  }

  onContentChanged() {
    let json: any;
    try {
      json = JSON.parse((this.context.model as any).value.text);
    } catch {
      return;
    }

    if (json) {
      const { $schema } = json;
      if ($schema && !this._schemaFinder.model.schemaPath) {
        this.schemaId = $schema;
      }

      if (!JSONExt.deepEqual(json, this.content.model.formData)) {
        this.content.model.formData = json;
      }
    }
  }

  onPathChanged() {
    this._schemaFinder.model.basePath = this.context.path;
    this._uiSchemaFinder.model.basePath = this.context.path;
  }

  get schemaId() {
    return this._schemaId;
  }

  set schemaId(schemaId) {
    if (this._schemaId === schemaId) {
      return;
    }

    this._schemaId = schemaId;

    if (this._schemaId) {
      if (this._schemaId.startsWith('.')) {
        // TODO: normalize?
        const path = PathExt.join(
          PathExt.dirname(this.context.path),
          this._schemaId
        );
        const widget = this.docManager.openOrReveal(path);
        if (widget) {
          this.schemaModel = widget.context.model;
        }
      } else {
        // handle explicit schema
        const uri = URLExt.parse(this._schemaId);
        console.error('TODO: handle uri', this._schemaId, uri);
      }
    }
  }

  get schemaModel() {
    return this._schemaModel;
  }

  set schemaModel(schemaModel) {
    if (this._schemaModel) {
      this._schemaModel.contentChanged.disconnect(this.onSchema, this);
    }
    this._schemaModel = schemaModel;
    if (this._schemaModel) {
      this._schemaModel.contentChanged.connect(this.onSchema, this);
      this.onSchema().catch(console.warn);
    }
  }

  get uiSchemaModel() {
    return this._schemaModel;
  }

  set uiSchemaModel(uiSchemaModel) {
    if (this._uiSchemaModel) {
      this._uiSchemaModel.contentChanged.disconnect(this.onUiSchema, this);
    }
    this._uiSchemaModel = uiSchemaModel;
    if (this._uiSchemaModel) {
      this._uiSchemaModel.contentChanged.connect(this.onUiSchema, this);
      this.onUiSchema().catch(console.warn);
    }
  }

  async onSchema() {
    if (this._schemaModel != null) {
      let json: any;
      let text: string;
      try {
        text = (this._schemaModel as any).value.text;
        json = JSON.parse(text);
      } catch (err) {
        console.warn(err, text);
      }
      if (
        (json && !this.content.model.schema) ||
        !JSONExt.deepEqual(this.content.model.schema, json)
      ) {
        this.content.model.schema = json;
      }
    }
  }

  async onUiSchema() {
    if (this._uiSchemaModel != null) {
      let json: any;
      let text: string;
      try {
        text = (this._uiSchemaModel as any).value.text;
        json = JSON.parse(text);
      } catch (err) {
        console.warn(err, text);
      }
      if (
        (json && !this.content.model.uiSchema) ||
        !JSONExt.deepEqual(this.content.model.uiSchema, json)
      ) {
        this.content.model.uiSchema = json;
      }
    }
  }
}

export namespace JSONSchemaFormDocument {
  export interface IOptions extends DocumentWidget.IOptions<SchemaForm> {
    docManager: IDocumentManager;
    getOpenWidgets: () => IIterator<Widget>;
  }
}

/**
 * A widget factory for rjsf.
 */
export class JSONSchemaFormFactory extends ABCWidgetFactory<
  JSONSchemaFormDocument,
  DocumentRegistry.IModel
> {
  private docManager: IDocumentManager;
  private getOpenWidgets: () => IIterator<Widget>;

  /**
   * Create a new widget given a context.
   */
  constructor(options: JSONSchemaFormFactory.IOptions) {
    super(options);
    this.docManager = options.docManager;
    this.getOpenWidgets = options.getOpenWidgets;
  }

  protected createNewWidget(
    context: DocumentRegistry.Context
  ): JSONSchemaFormDocument {
    return new JSONSchemaFormDocument({
      context,
      docManager: this.docManager,
      getOpenWidgets: this.getOpenWidgets,
      content: new SchemaForm(
        {},
        {
          liveValidate: true,
          ...ALL_CUSTOM_UI
        }
      )
    });
  }
}

export namespace JSONSchemaFormFactory {
  export interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
    docManager: IDocumentManager;
    getOpenWidgets: () => IIterator<Widget>;
  }
}
