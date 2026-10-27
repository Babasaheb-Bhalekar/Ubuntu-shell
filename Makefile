# Retrieve the UUID from ``metadata.json``
UUID = $(shell grep -E '^[ ]*"uuid":' ./metadata.json | sed 's@^[ ]*"uuid":[ ]*"\(.\+\)",[ ]*@\1@')
VERSION = $(shell grep version tsconfig.json | awk -F\" '{print $$4}')

ifeq ($(XDG_DATA_HOME),)
XDG_DATA_HOME = $(HOME)/.local/share
endif

ifeq ($(strip $(DESTDIR)),)
INSTALLBASE = $(XDG_DATA_HOME)/gnome-shell/extensions
SCRIPTS_BASE = $(XDG_DATA_HOME)/ubuntu-shell/scripts
else
INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
SCRIPTS_BASE = $(DESTDIR)/usr/lib/ubuntu-shell/scripts
endif
INSTALLNAME = $(UUID)

PROJECTS = color_dialog floating_exceptions

$(info UUID is "$(UUID)")

.PHONY: all clean install zip-file

sources = src/*.ts *.css

all: depcheck compile

clean:
	rm -rf _build target

# Configure local settings on system
configure:
	python3 scripts/shortcuts.py migrate
	python3 scripts/shortcuts.py apply

compile: $(sources) clean
	env PROJECTS="$(PROJECTS)" ./scripts/transpile.sh

# Rebuild, install, apply local shortcuts, and listen to shell logs
debug: depcheck compile install configure enable listen

depcheck:
	@echo depcheck
	@if ! command -v tsc >/dev/null; then \
		echo \
		echo 'You must install TypeScript >= 3.8 to transpile: (node-typescript on Debian systems)'; \
		exit 1; \
	fi

enable:
	@python3 scripts/shortcuts.py enable
	@if gnome-extensions info "$(UUID)" >/dev/null 2>&1; then \
		if gnome-extensions list --enabled | grep -Fxq "$(UUID)"; then \
			echo 'Ubuntu Shell files are updated. Log out and back in to load the new code in GNOME Wayland.'; \
		else \
			gnome-extensions enable "$(UUID)"; \
		fi; \
	else \
		echo 'Ubuntu Shell is installed. Log out and back in to load it in GNOME Wayland.'; \
	fi

disable:
	python3 scripts/shortcuts.py disable

listen:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning

local-install: depcheck compile install configure enable
	@python3 -c 'from pathlib import Path; import shutil; p=Path("$(INSTALLBASE)/pop-shell@system76.com"); shutil.rmtree(p) if p.is_dir() and not p.is_symlink() else None'

install:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME) $(SCRIPTS_BASE)
	cp -r _build/* $(INSTALLBASE)/$(INSTALLNAME)/
	cp scripts/shortcuts.py $(SCRIPTS_BASE)/

uninstall:
	python3 scripts/shortcuts.py disable
	python3 scripts/shortcuts.py restore
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)

zip-file: all
	rm -f "$(UUID)_$(VERSION).zip"
	cd _build && zip -qr "../$(UUID)_$(VERSION).zip" .

.NOTPARALLEL: debug local-install
