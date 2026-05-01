const isPersonalisationFieldVisible = (fieldWrapper) => {
  if (!fieldWrapper || !fieldWrapper.isConnected || fieldWrapper.hidden) return false;

  const fieldWrapperStyles = window.getComputedStyle(fieldWrapper);
  if (fieldWrapperStyles.display === 'none' || fieldWrapperStyles.visibility === 'hidden') return false;

  return fieldWrapper.getClientRects().length > 0;
};

const syncPersonalisationFieldRequirements = (root = document) => {
  root.querySelectorAll('[data-nameplate-properties] input, [data-nameplate-properties] textarea, [data-nameplate-properties] select').forEach((field) => {
    const fieldWrapper = field.closest('[data-property-wrapper]');
    if (!fieldWrapper || !isPersonalisationFieldVisible(fieldWrapper)) {
      field.required = false;
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  syncPersonalisationFieldRequirements();
});

if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.requiredPropertyWrappers = Array.from(
          this.form.querySelectorAll('[data-property-wrapper][data-property-required="true"]')
        );
        this.onPropertyFieldChange = this.onPropertyFieldChange.bind(this);
        syncPersonalisationFieldRequirements(this.form);

        if (this.requiredPropertyWrappers.length) {
          this.form.addEventListener('input', this.onPropertyFieldChange);
          this.form.addEventListener('change', this.onPropertyFieldChange);
        }

        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        if (!this.validateRequiredProperties()) {
          evt.preventDefault();
          return;
        }

        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.cart.renderContents(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.cart.renderContents(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      onPropertyFieldChange(event) {
        const fieldWrapper = event.target.closest('[data-property-wrapper]');
        if (!fieldWrapper || fieldWrapper.dataset.propertyRequired !== 'true') return;
        this.validatePropertyWrapper(fieldWrapper);
      }

      validateRequiredProperties() {
        const visibleRequiredPropertyWrappers = this.requiredPropertyWrappers.filter((fieldWrapper) =>
          isPersonalisationFieldVisible(fieldWrapper)
        );
        if (!visibleRequiredPropertyWrappers.length) return true;

        let firstInvalidInput = null;
        visibleRequiredPropertyWrappers.forEach((fieldWrapper) => {
          const isValid = this.validatePropertyWrapper(fieldWrapper);
          if (!isValid && !firstInvalidInput) {
            firstInvalidInput = fieldWrapper.querySelector('input, textarea, select');
          }
        });

        if (firstInvalidInput) {
          firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return false;
        }

        return true;
      }

      validatePropertyWrapper(fieldWrapper) {
        const propertyName = fieldWrapper.dataset.propertyName;
        if (!propertyName) return true;
        if (!isPersonalisationFieldVisible(fieldWrapper)) {
          fieldWrapper.querySelectorAll('input, textarea, select').forEach((control) => {
            control.required = false;
          });
          this.togglePropertyError(fieldWrapper, false);
          return true;
        }

        const controls = Array.from(fieldWrapper.querySelectorAll(`[name="${propertyName}"]`));
        if (!controls.length) return true;

        const isRadioGroup = controls[0].type === 'radio';
        const hasValue = isRadioGroup
          ? controls.some((control) => control.checked)
          : Boolean(controls[0].value && controls[0].value.trim());

        this.togglePropertyError(fieldWrapper, !hasValue);
        return hasValue;
      }

      togglePropertyError(fieldWrapper, hasError) {
        const errorMessage = fieldWrapper.querySelector('.nameplate-field__error');
        const controls = fieldWrapper.querySelectorAll('input, textarea, select');

        controls.forEach((control) => {
          if (hasError) {
            control.setAttribute('aria-invalid', 'true');
          } else {
            control.removeAttribute('aria-invalid');
          }
        });

        fieldWrapper.classList.toggle('is-invalid', hasError);
        if (errorMessage) {
          errorMessage.toggleAttribute('hidden', !hasError);
        }
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
