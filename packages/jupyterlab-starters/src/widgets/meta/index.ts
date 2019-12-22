import { JSONObject } from '@phosphor/coreutils';
import { Widget, BoxLayout } from '@phosphor/widgets';

import { CSS } from '../../css';
import { SchemaForm } from '../schemaform';
import { PreviewCard } from '../previewcard';
import { RawJSONObjectField } from '../rawjson';

import { NotebookMetadataModel } from './model';

const AS_TEXTAREA = { 'ui:widget': 'textarea' };
const AS_JSONOBJECT = { 'ui:field': 'jsonobject' };

export class NotebookMetadata extends Widget {
  private _form: SchemaForm<JSONObject>;
  private _preview: PreviewCard;

  model: NotebookMetadataModel;

  constructor(options: NotebookMetadataModel.IOptions) {
    super(options);
    this.model = new NotebookMetadataModel(options);
    this.layout = new BoxLayout();
    this.id = Private.nextId();
    this.addClass(CSS.META);
    this.addClass(CSS.FORM_PANEL);

    this._form = new SchemaForm(this.model.liveSchema, {
      liveValidate: true,
      uiSchema: {
        description: AS_TEXTAREA,
        icon: AS_TEXTAREA,
        schema: AS_JSONOBJECT,
        uiSchema: AS_JSONOBJECT,
        commands: {
          items: {
            args: AS_JSONOBJECT
          }
        }
      },
      fields: {
        jsonobject: RawJSONObjectField
      }
    });
    this.model.form = this._form.model;

    this._preview = new PreviewCard();
    this.model.stateChanged.connect(() => {
      this._preview.model.starter = (this.model.form.formData as any) || {};
      this._form.setHidden(!this.model.notebook);
    });

    this.boxLayout.addWidget(this._form);
    this.boxLayout.addWidget(this._preview);
  }

  get boxLayout() {
    return this.layout as BoxLayout;
  }

  dispose() {
    super.dispose();
    if (!this.isDisposed) {
      this.model.dispose();
    }
  }
}

namespace Private {
  let _nextId = 0;
  export function nextId() {
    return `id-jp-starters-notebook-${name}-${_nextId++}`;
  }
}