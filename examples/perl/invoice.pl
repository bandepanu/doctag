#!/usr/bin/perl
# @docarch: component = "Billing", layer = "core"
# @docdeps: allowed_imports = ["strict", "warnings", "List::Util"]
# @docenv: runtime = "perl>=5.36"
use strict;
use warnings;
use List::Util qw(sum0);

# In Perl the native $ @ % sigils ARE the doctype layer — no s_/a_/d_ prefixes.
# @docslim: max_lines = 8, max_nested_depth = 2, max_complexity = 4
# @docpure: deterministic = true, mutates_state = false
sub process_invoice {
    my ($user_id, @items_list, %config) = @_;
    my $total = sum0(map { $_->{price} } @items_list);
    return { status => "success", total => $total };
}

1;
