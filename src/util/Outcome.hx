enum Outcome<A, E> {
    Success(value: A);
    Failure(error: E);
}
