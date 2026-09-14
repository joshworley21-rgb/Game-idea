class_name Rng
extends RefCounted
## Small deterministic PRNG (mulberry32) so a seed replays identically.

var _state: int = 0


func _init(seed: int = 1) -> void:
	_state = seed & 0xFFFFFFFF


func _imul(a: int, b: int) -> int:
	return (a * b) & 0xFFFFFFFF


func next() -> float:
	_state = (_state + 0x6d2b79f5) & 0xFFFFFFFF
	var t: int = _state
	t = _imul(t ^ (t >> 15), t | 1)
	t = (t ^ (t + _imul(t ^ (t >> 7), t | 61))) & 0xFFFFFFFF
	return float(t ^ (t >> 14)) / 4294967296.0


func range_float(min_v: float, max_v: float) -> float:
	return min_v + next() * (max_v - min_v)


func range_int(min_v: int, max_v: int) -> int:
	return int(floor(range_float(float(min_v), float(max_v) + 1.0)))


func chance(p: float) -> bool:
	return next() < p


func pick(items: Array):
	if items.is_empty():
		return null
	return items[int(floor(next() * float(items.size())))] as Variant


func weighted(items: Array, weight_fn: Callable):
	var total := 0.0
	for it in items:
		total += maxf(0.0, float(weight_fn.call(it)))
	if total <= 0.0:
		return null
	var roll := next() * total
	for it in items:
		roll -= maxf(0.0, float(weight_fn.call(it)))
		if roll <= 0.0:
			return it
	return items[items.size() - 1] if items.size() > 0 else null
