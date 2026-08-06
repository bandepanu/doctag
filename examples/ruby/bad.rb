# @docdeps: allowed_imports = ["set"]
require "json"

# @docslim: max_lines = 3, max_nested_depth = 1, max_complexity = 2
# @docpure: deterministic = true
def handle(amount, d_items)
  puts "side effect"
  if amount
    if amount > 1
      return d_items.length
    end
  end
  0
end
