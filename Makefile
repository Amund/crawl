# NOTE: les arguments précédés par des moins (-y, --version) seront capturés par make et ne seront pas disponibles pour les commandes
#
# On peut les forcer en ajoutant un argument "--" :
# Tout ce qui suit cet argument spécial n'est pas capturé par make, et sera donc correctement envoyé vers les commandes
#
# La notation générique permet de complètement contourner ce problème : make [action] -- [arguments]
# exemples :
#   make drush -- cim -y
#   make npm -- install malib --save-dev


## GESTION DES CONTAINERS
.PHONY: up down shell shell-root logs

up: # Start up containers
	@docker compose up -d --remove-orphans
down: # Stop containers
	@docker compose down
shell:
	@docker compose exec app /bin/bash
shell-root:
	@docker compose exec -u 0:0 app /bin/bash
logs:
	@docker compose logs -f || true


## OUTILS COURANTS
.PHONY: composer drush wp npm npx gulp deno

node:
	@docker compose exec app node $(filter-out $@,$(MAKECMDGOALS)) || true
npm :
	@docker compose exec app npm $(filter-out $@,$(MAKECMDGOALS)) || true
npx:
	@docker compose exec app npx $(filter-out $@,$(MAKECMDGOALS)) || true

%:
	@:
