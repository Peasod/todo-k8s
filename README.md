# todo-k8s

Starter CRUD app (Node/Express + Postgres) with Kubernetes manifests.

## Layout
- `app/` – API + static UI, Dockerfile
- `deploy/base` – namespace, Secret, Postgres StatefulSet (PVC), app Deployment/Service, Ingress
- `deploy/overlays/dev` – Kustomize overlay (image tag)
- `kind.yaml` – kind cluster with ports 80/443 mapped to the host
- `.github/workflows/ci.yml` – builds and pushes the image to GHCR

## 1. Inner loop (local)
```bash
docker compose up --build
# http://localhost:3000
```

## 2. Run in kind
```bash
kind create cluster --config kind.yaml
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=120s

docker build -t ghcr.io/peasod/todo-app:dev ./app
kind load docker-image ghcr.io/peasod/todo-app:dev
(cd deploy/overlays/dev && kustomize edit set image ghcr.io/peasod/todo-app=ghcr.io/peasod/todo-app:dev)
kubectl apply -k deploy/overlays/dev
# http://localhost
```
Don't commit the `:dev` tag; use a CI-built tag for Argo CD.

## 3. Argo CD
Repo URL of this repo, revision `main`, path `deploy/overlays/dev`, namespace `todo`.
The GHCR package must be public (or add an imagePullSecret).

## Notes
- `deploy/base/secret.yaml` is a dev-only placeholder. Use Sealed Secrets / External Secrets for real credentials.
- Schema is created on app start; use a migration tool for real projects.
