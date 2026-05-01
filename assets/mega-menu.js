(() => {
  const DESKTOP_QUERY = '(min-width: 990px)';
  const OPEN_DELAY = 150;
  const CLOSE_DELAY = 200;

  const initializeMegaMenu = (scope = document) => {
    const nav = scope.querySelector('[data-mega-nav]');
    if (!nav || nav.dataset.megaInitialized === 'true') return;
    nav.dataset.megaInitialized = 'true';

    const navItems = Array.from(nav.querySelectorAll('.nav-item--has-mega'));
    if (!navItems.length) return;

    const desktopMedia = window.matchMedia(DESKTOP_QUERY);

    let activeItem = null;
    let openTimeout = null;
    let closeTimeout = null;

    const getTrigger = (item) => item.querySelector('[data-mega-trigger]');
    const getMenu = (item) => item.querySelector('[data-mega-menu]');

    const clearOpenTimeout = () => {
      if (openTimeout) window.clearTimeout(openTimeout);
      openTimeout = null;
    };

    const clearCloseTimeout = () => {
      if (closeTimeout) window.clearTimeout(closeTimeout);
      closeTimeout = null;
    };

    const clearTimers = () => {
      clearOpenTimeout();
      clearCloseTimeout();
    };

    const setFocusableItems = (menu, isOpen) => {
      const items = menu.querySelectorAll('.mega-menu__item');
      items.forEach((menuItem) => {
        menuItem.setAttribute('tabindex', isOpen ? '0' : '-1');
      });
    };

    const setMenuState = (item, isOpen) => {
      const trigger = getTrigger(item);
      const menu = getMenu(item);
      if (!trigger || !menu) return;

      item.classList.toggle('is-open', isOpen);
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      setFocusableItems(menu, isOpen);

      if (!desktopMedia.matches) {
        menu.style.maxHeight = isOpen ? `${menu.scrollHeight}px` : '0px';
      } else {
        menu.style.maxHeight = '';
      }
    };

    function openMenu(item) {
      if (!item) return;
      closeAllMenus(item);
      setMenuState(item, true);
      activeItem = item;
    }

    function closeMenu(item) {
      if (!item) return;
      setMenuState(item, false);
      if (activeItem === item) activeItem = null;
    }

    function closeAllMenus(exceptItem = null) {
      navItems.forEach((item) => {
        if (item !== exceptItem) closeMenu(item);
      });
      if (!exceptItem) activeItem = null;
    }

    const scheduleOpen = (item) => {
      clearCloseTimeout();
      clearOpenTimeout();
      openTimeout = window.setTimeout(() => {
        openMenu(item);
      }, OPEN_DELAY);
    };

    const scheduleClose = (item) => {
      clearOpenTimeout();
      clearCloseTimeout();
      closeTimeout = window.setTimeout(() => {
        if (activeItem === item) closeMenu(item);
      }, CLOSE_DELAY);
    };

    // Mobile: toggle sub-collection panels
    const initSubToggles = () => {
      nav.querySelectorAll('.mega-menu__item--has-sub').forEach((subItem) => {
        if (subItem.dataset.subInitialized) return;
        subItem.dataset.subInitialized = 'true';

        const link = subItem.querySelector('.mega-menu__item-link');
        if (!link) return;

        link.addEventListener('click', (event) => {
          if (desktopMedia.matches) return;
          event.preventDefault();
          const isOpen = subItem.classList.toggle('is-sub-open');
          link.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
      });
    };

    navItems.forEach((item) => {
      setMenuState(item, false);

      // Desktop: hover open/close
      item.addEventListener('mouseenter', () => {
        if (!desktopMedia.matches) return;
        scheduleOpen(item);
      });

      item.addEventListener('mouseleave', (event) => {
        if (!desktopMedia.matches) return;
        if (!item.contains(event.relatedTarget)) {
          scheduleClose(item);
        } else {
          clearCloseTimeout();
        }
      });

      // Mobile: click trigger to toggle mega menu
      const trigger = getTrigger(item);
      if (trigger) {
        trigger.addEventListener('click', (event) => {
          if (desktopMedia.matches) return;
          event.preventDefault();
          const isOpen = item.classList.contains('is-open');
          closeAllMenus(isOpen ? null : item);
          setMenuState(item, !isOpen);
        });
      }
    });

    initSubToggles();

    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target)) {
        clearTimers();
        closeAllMenus();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !activeItem) return;
      const activeTrigger = getTrigger(activeItem);
      clearTimers();
      closeAllMenus();
      if (activeTrigger) activeTrigger.focus();
    });

    const handleViewportChange = () => {
      clearTimers();
      closeAllMenus();
    };

    if (desktopMedia.addEventListener) {
      desktopMedia.addEventListener('change', handleViewportChange);
    } else if (desktopMedia.addListener) {
      desktopMedia.addListener(handleViewportChange);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeMegaMenu(document));
  } else {
    initializeMegaMenu(document);
  }
})();
