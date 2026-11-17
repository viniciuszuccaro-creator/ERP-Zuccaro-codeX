#!/usr/bin/env bash
set -euo pipefail
image="$1"
destination="$2"
[[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]]
[[ ! -e "$destination" ]]
[[ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")" == 'linux/amd64' ]]
mkdir -p "$destination/native/usr/bin" "$destination/native/usr/lib/x86_64-linux-gnu" "$destination/native/licenses"
container="$(docker create "$image")"
trap 'docker rm "$container" >/dev/null' EXIT
docker cp -L "$container:/usr/bin/openssl" "$destination/native/usr/bin/openssl"
for library in libssl.so.3 libcrypto.so.3; do
  docker cp -L "$container:/usr/lib/x86_64-linux-gnu/$library" "$destination/native/usr/lib/x86_64-linux-gnu/$library"
done
docker cp -L "$container:/usr/share/doc/openssl/copyright" "$destination/native/licenses/openssl.txt"
docker cp -L "$container:/usr/share/doc/libssl3/copyright" "$destination/native/licenses/libssl3.txt"
python3 - "$destination" "$image" <<'PY'
import pathlib,hashlib,json,os,sys,subprocess
root=pathlib.Path(sys.argv[1]);files=[]
for p in sorted((root/'native').rglob('*')):
 if p.is_dir():continue
 assert p.is_file() and not p.is_symlink()
 files.append({'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
version=subprocess.check_output(['docker','run','--rm','--network','none','--read-only','--entrypoint','/usr/bin/openssl',sys.argv[2],'version'],text=True).strip()
manifest={'kind':'CANONICAL_LINUX_A1_NATIVE_OVERLAY','sha':os.environ['GITHUB_SHA'],'image':sys.argv[2],'platform':'linux/amd64','opensslVersion':version,'files':files,'privateDataIncluded':False,'mustPassExistingImageSmokeBeforeUse':True}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'files':len(files),'bytes':sum(f['bytes'] for f in files),'sourceSha':manifest['sha']}))
PY
tar -czf "$destination/native-a1.tar.gz" -C "$destination" native manifest.json
sha256sum "$destination/native-a1.tar.gz" > "$destination/native-a1.sha256"
