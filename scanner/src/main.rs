use std::env;
use std::fs;
use std::process;

fn arg_value(args: &[String], flag: &str) -> Option<String> {
    args.windows(2)
        .find(|pair| pair[0] == flag)
        .map(|pair| pair[1].clone())
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.iter().any(|flag| flag == "--lightwalletd") {
        eprintln!(
            "Live UFVK trial-decrypt is not in this binary yet. Compact blocks omit memos (ZIP-307). Use --fixture until zcash_client_backend scan lands. TypeScript will not decrypt."
        );
        process::exit(1);
    }

    let Some(path) = arg_value(&args, "--fixture") else {
        eprintln!("zcash-scan --fixture <notes.json>");
        eprintln!("zcash-scan --lightwalletd <host:port>  (fail closed until trial-decrypt exists)");
        process::exit(1);
    };

    match fs::read_to_string(&path) {
        Ok(body) => print!("{body}"),
        Err(error) => {
            eprintln!("{error}");
            process::exit(1);
        }
    }
}
