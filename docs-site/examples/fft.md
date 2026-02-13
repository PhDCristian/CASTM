# Streaming + Route

Streaming IO plus explicit route transfer.

```openedge
target "uma-cgra-base";

kernel "stream_route_example" {
  stream_load(dest=R0, row=0, count=2);
  rotate(reg=R0, direction=left, distance=1);
  route(@0,1 -> @0,0, payload=R0, accum=R1);
  shift(reg=R1, direction=right, distance=1, fill=0);
  stream_store(src=R1, row=0, count=2);
}
```
