package main

// @docdeps: allowed_imports = ["math"]
import "os"

// @docslim: max_lines = 3, max_nested_depth = 1, max_complexity = 2
// @docpure: deterministic = true
func Handle(amount int, a_ctx map[string]string) int {
	fmt.Println("side effect")
	if amount > 0 {
		if amount > 1 {
			return len(a_ctx)
		}
	}
	_ = os.Getpid()
	return 0
}
