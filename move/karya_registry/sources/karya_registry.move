module karya_registry::registry {
    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::table::{Self, Table};
    use aptos_framework::timestamp;
    use std::bcs;
    use std::signer;
    use std::vector;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_NOT_REGISTRY_ADMIN: u64 = 3;
    const E_EMPTY_WORK_ID: u64 = 4;
    const E_EMPTY_BLOB_NAME: u64 = 5;
    const E_EMPTY_MERKLE_ROOT: u64 = 6;
    const E_ZERO_SIZE: u64 = 7;
    const E_INVALID_EXPIRY: u64 = 8;
    const E_INVALID_REVISION: u64 = 9;
    const E_INVALID_PARENT: u64 = 10;
    const E_PARENT_NOT_FOUND: u64 = 11;
    const E_PARENT_CREATOR_MISMATCH: u64 = 12;
    const E_DUPLICATE_WORK: u64 = 13;
    const E_INVALID_PRICE: u64 = 14;
    const E_WORK_NOT_FOUND: u64 = 15;
    const E_NOT_CREATOR: u64 = 16;
    const E_WORK_INACTIVE: u64 = 17;
    const E_WORK_EXPIRED: u64 = 18;
    const E_FREE_WORK: u64 = 19;
    const E_SELF_PURCHASE: u64 = 20;
    const E_WRONG_CURRENCY: u64 = 21;
    const E_ALREADY_ENTITLED: u64 = 22;
    const E_ENCRYPTION_REQUIRED: u64 = 23;
    const E_UNEXPECTED_ENCRYPTION: u64 = 24;

    /// Canonical KaryaChain state. The table contents are the source of truth;
    /// indexers are only read models derived from this state and its events.
    struct Registry has key {
        works: Table<vector<u8>, Work>,
        entitlements: Table<vector<u8>, Entitlement>,
    }

    /// A work points to a committed Shelby blob. The file bytes never belong
    /// in Aptos state; the Merkle root and immutable blob identity do.
    struct Work has store {
        creator: address,
        shelby_owner: address,
        blob_name: vector<u8>,
        merkle_root: vector<u8>,
        size: u64,
        created_at_micros: u64,
        expires_at_micros: u64,
        revision: u64,
        parent_work_id: vector<u8>,
        price_micro: u64,
        currency_metadata: address,
        encrypted_key_envelope: vector<u8>,
        active: bool,
    }

    struct Entitlement has store {
        granted_at_micros: u64,
        expires_at_micros: u64,
    }

    #[event]
    struct WorkPublished has drop, store {
        work_id: vector<u8>,
        creator: address,
        shelby_owner: address,
        blob_name: vector<u8>,
        merkle_root: vector<u8>,
        size: u64,
        expires_at_micros: u64,
        revision: u64,
        parent_work_id: vector<u8>,
        price_micro: u64,
        currency_metadata: address,
        encrypted_key_envelope: vector<u8>,
    }

    #[event]
    struct WorkStatusChanged has drop, store {
        work_id: vector<u8>,
        creator: address,
        active: bool,
    }

    #[event]
    struct PremiumPurchased has drop, store {
        work_id: vector<u8>,
        buyer: address,
        creator: address,
        amount_micro: u64,
        currency_metadata: address,
        expires_at_micros: u64,
    }

    #[event]
    struct EntitlementGranted has drop, store {
        work_id: vector<u8>,
        buyer: address,
        expires_at_micros: u64,
    }

    /// Initializes the registry at the module publishing address. This is a
    /// one-time operation and deliberately requires the module account.
    public entry fun initialize(admin: &signer) {
        let admin_address = signer::address_of(admin);
        assert!(admin_address == @karya_registry, E_NOT_REGISTRY_ADMIN);
        assert!(!exists<Registry>(@karya_registry), E_ALREADY_INITIALIZED);

        move_to(admin, Registry {
            works: table::new<vector<u8>, Work>(),
            entitlements: table::new<vector<u8>, Entitlement>(),
        });
    }

    /// Publishes a Shelby-backed work or the next immutable revision of one.
    /// The creator signs this call, so the creator identity is never accepted
    /// as an untrusted function argument.
    public entry fun publish_work(
        creator: &signer,
        work_id: vector<u8>,
        blob_name: vector<u8>,
        merkle_root: vector<u8>,
        size: u64,
        expires_at_micros: u64,
        revision: u64,
        parent_work_id: vector<u8>,
        price_micro: u64,
        currency_metadata: address,
        encrypted_key_envelope: vector<u8>,
    ) acquires Registry {
        assert!(exists<Registry>(@karya_registry), E_NOT_INITIALIZED);
        assert!(!vector::is_empty(&work_id), E_EMPTY_WORK_ID);
        assert!(!vector::is_empty(&blob_name), E_EMPTY_BLOB_NAME);
        assert!(!vector::is_empty(&merkle_root), E_EMPTY_MERKLE_ROOT);
        assert!(size > 0, E_ZERO_SIZE);
        assert!(expires_at_micros > timestamp::now_microseconds(), E_INVALID_EXPIRY);
        assert!(revision > 0, E_INVALID_REVISION);

        if (price_micro == 0) {
            assert!(currency_metadata == @0x0, E_INVALID_PRICE);
            assert!(vector::is_empty(&encrypted_key_envelope), E_UNEXPECTED_ENCRYPTION);
        } else {
            assert!(currency_metadata != @0x0, E_INVALID_PRICE);
            assert!(!vector::is_empty(&encrypted_key_envelope), E_ENCRYPTION_REQUIRED);
        };

        let creator_address = signer::address_of(creator);
        {
            let registry = borrow_global<Registry>(@karya_registry);
            assert!(!table::contains(&registry.works, copy work_id), E_DUPLICATE_WORK);

            if (revision == 1) {
                assert!(vector::is_empty(&parent_work_id), E_INVALID_PARENT);
            } else {
                assert!(!vector::is_empty(&parent_work_id), E_INVALID_PARENT);
                assert!(table::contains(&registry.works, copy parent_work_id), E_PARENT_NOT_FOUND);
                let parent = table::borrow(&registry.works, copy parent_work_id);
                assert!(parent.creator == creator_address, E_PARENT_CREATOR_MISMATCH);
                assert!(revision == parent.revision + 1, E_INVALID_REVISION);
            };
        };

        let stored_blob_name = copy blob_name;
        let stored_merkle_root = copy merkle_root;
        let stored_encrypted_key_envelope = copy encrypted_key_envelope;
        let stored_parent_work_id = copy parent_work_id;
        let event_work_id = copy work_id;
        let event_blob_name = copy blob_name;
        let event_merkle_root = copy merkle_root;
        let event_parent_work_id = copy parent_work_id;
        let event_encrypted_key_envelope = copy encrypted_key_envelope;

        let registry = borrow_global_mut<Registry>(@karya_registry);
        table::add(
            &mut registry.works,
            work_id,
            Work {
                creator: creator_address,
                shelby_owner: creator_address,
                blob_name: stored_blob_name,
                merkle_root: stored_merkle_root,
                size,
                created_at_micros: timestamp::now_microseconds(),
                expires_at_micros,
                revision,
                parent_work_id: stored_parent_work_id,
                price_micro,
                currency_metadata,
                encrypted_key_envelope: stored_encrypted_key_envelope,
                active: true,
            },
        );

        event::emit(WorkPublished {
            work_id: event_work_id,
            creator: creator_address,
            shelby_owner: creator_address,
            blob_name: event_blob_name,
            merkle_root: event_merkle_root,
            size,
            expires_at_micros,
            revision,
            parent_work_id: event_parent_work_id,
            price_micro,
            currency_metadata,
            encrypted_key_envelope: event_encrypted_key_envelope,
        });
    }

    /// Allows only the creator to deactivate or reactivate a work. This does
    /// not delete the Shelby blob or rewrite its immutable proof metadata.
    public entry fun set_work_active(
        creator: &signer,
        work_id: vector<u8>,
        active: bool,
    ) acquires Registry {
        assert!(exists<Registry>(@karya_registry), E_NOT_INITIALIZED);
        let creator_address = signer::address_of(creator);
        {
            let registry = borrow_global_mut<Registry>(@karya_registry);
            assert!(table::contains(&registry.works, copy work_id), E_WORK_NOT_FOUND);
            let work = table::borrow_mut(&mut registry.works, copy work_id);
            assert!(work.creator == creator_address, E_NOT_CREATOR);
            work.active = active;
        };

        event::emit(WorkStatusChanged {
            work_id,
            creator: creator_address,
            active,
        });
    }

    /// Atomically transfers the exact registered fungible-asset amount to the
    /// creator and records buyer entitlement. The payment metadata address is
    /// checked on-chain against the work; the frontend cannot substitute an
    /// arbitrary asset or amount.
    public entry fun purchase(
        buyer: &signer,
        work_id: vector<u8>,
        payment_metadata: address,
    ) acquires Registry {
        assert!(exists<Registry>(@karya_registry), E_NOT_INITIALIZED);
        let buyer_address = signer::address_of(buyer);
        let entitlement_id = entitlement_key(buyer_address, &work_id);
        let creator_address: address;
        let price_micro: u64;
        let currency_metadata: address;
        let expires_at_micros: u64;

        {
            let registry = borrow_global<Registry>(@karya_registry);
            assert!(table::contains(&registry.works, copy work_id), E_WORK_NOT_FOUND);
            assert!(!table::contains(&registry.entitlements, copy entitlement_id), E_ALREADY_ENTITLED);

            let work = table::borrow(&registry.works, copy work_id);
            assert!(work.active, E_WORK_INACTIVE);
            assert!(work.expires_at_micros >= timestamp::now_microseconds(), E_WORK_EXPIRED);
            assert!(work.price_micro > 0, E_FREE_WORK);
            assert!(work.creator != buyer_address, E_SELF_PURCHASE);
            assert!(work.currency_metadata == payment_metadata, E_WRONG_CURRENCY);

            creator_address = work.creator;
            price_micro = work.price_micro;
            currency_metadata = work.currency_metadata;
            expires_at_micros = work.expires_at_micros;
        };

        let metadata = object::address_to_object<fungible_asset::Metadata>(currency_metadata);
        primary_fungible_store::transfer(buyer, metadata, creator_address, price_micro);

        let entitlement_work_id = copy work_id;
        let event_work_id = copy work_id;
        let registry = borrow_global_mut<Registry>(@karya_registry);
        table::add(
            &mut registry.entitlements,
            entitlement_id,
            Entitlement {
                granted_at_micros: timestamp::now_microseconds(),
                expires_at_micros,
            },
        );

        event::emit(PremiumPurchased {
            work_id: event_work_id,
            buyer: buyer_address,
            creator: creator_address,
            amount_micro: price_micro,
            currency_metadata,
            expires_at_micros,
        });
        event::emit(EntitlementGranted {
            work_id: entitlement_work_id,
            buyer: buyer_address,
            expires_at_micros,
        });
    }

    #[view]
    public fun work_exists(work_id: vector<u8>): bool acquires Registry {
        if (!exists<Registry>(@karya_registry)) {
            return false
        };
        let registry = borrow_global<Registry>(@karya_registry);
        table::contains(&registry.works, copy work_id)
    }

    #[view]
    public fun get_work(
        work_id: vector<u8>,
    ): (address, address, vector<u8>, vector<u8>, u64, u64, u64, u64, vector<u8>, u64, address, vector<u8>, bool) acquires Registry {
        let registry = borrow_global<Registry>(@karya_registry);
        let work = table::borrow(&registry.works, copy work_id);
        (
            work.creator,
            work.shelby_owner,
            copy_bytes(&work.blob_name),
            copy_bytes(&work.merkle_root),
            work.size,
            work.created_at_micros,
            work.expires_at_micros,
            work.revision,
            copy_bytes(&work.parent_work_id),
            work.price_micro,
            work.currency_metadata,
            copy_bytes(&work.encrypted_key_envelope),
            work.active,
        )
    }

    #[view]
    public fun has_entitlement(buyer: address, work_id: vector<u8>): bool acquires Registry {
        if (!exists<Registry>(@karya_registry)) {
            return false
        };
        let registry = borrow_global<Registry>(@karya_registry);
        let entitlement_id = entitlement_key(buyer, &work_id);
        if (!table::contains(&registry.entitlements, copy entitlement_id)) {
            return false
        };
        let entitlement = table::borrow(&registry.entitlements, copy entitlement_id);
        entitlement.expires_at_micros >= timestamp::now_microseconds()
    }

    #[view]
    public fun get_entitlement(
        buyer: address,
        work_id: vector<u8>,
    ): (bool, u64, u64) acquires Registry {
        if (!exists<Registry>(@karya_registry)) {
            return (false, 0, 0)
        };
        let registry = borrow_global<Registry>(@karya_registry);
        let entitlement_id = entitlement_key(buyer, &work_id);
        if (!table::contains(&registry.entitlements, copy entitlement_id)) {
            return (false, 0, 0)
        };
        let entitlement = table::borrow(&registry.entitlements, copy entitlement_id);
        (true, entitlement.granted_at_micros, entitlement.expires_at_micros)
    }

    fun copy_bytes(input: &vector<u8>): vector<u8> {
        let output = vector::empty();
        vector::append(&mut output, *input);
        output
    }

    fun entitlement_key(buyer: address, work_id: &vector<u8>): vector<u8> {
        let key = bcs::to_bytes(&buyer);
        vector::append(&mut key, *work_id);
        key
    }

    #[test_only]
    fun setup_time(aptos_framework: &signer) {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        timestamp::update_global_time_for_test(1_000_000);
    }

    #[test(aptos_framework = @0x1, publisher = @karya_registry, creator = @0xcafe)]
    fun publish_first_work(aptos_framework: &signer, publisher: &signer, creator: &signer) {
        setup_time(aptos_framework);
        initialize(publisher);
        let expires_at = timestamp::now_microseconds() + 1_000_000;
        publish_work(
            creator,
            b"work-1",
            b"photo.jpg",
            x"00112233445566778899aabbccddeeff",
            2048,
            expires_at,
            1,
            vector::empty(),
            0,
            @0x0, vector::empty());

        assert!(work_exists(b"work-1"), 100);
        let (owner, shelby_owner, blob_name, merkle_root, size, _, expiry, revision, parent, price, currency, envelope, active) = get_work(b"work-1");
        assert!(owner == @0xcafe, 101);
        assert!(shelby_owner == @0xcafe, 102);
        assert!(blob_name == b"photo.jpg", 103);
        assert!(merkle_root == x"00112233445566778899aabbccddeeff", 104);
        assert!(size == 2048, 105);
        assert!(expiry == expires_at, 106);
        assert!(revision == 1, 107);
        assert!(vector::is_empty(&parent), 108);
        assert!(price == 0, 109);
        assert!(currency == @0x0, 110);
        assert!(vector::is_empty(&envelope), 112);
        assert!(active, 111);
    }

    #[test(aptos_framework = @0x1, publisher = @karya_registry, creator = @0xcafe)]
    fun publish_revision_requires_parent_lineage(aptos_framework: &signer, publisher: &signer, creator: &signer) {
        setup_time(aptos_framework);
        initialize(publisher);
        let expires_at = timestamp::now_microseconds() + 1_000_000;
        publish_work(
            creator,
            b"work-1",
            b"photo-v1.jpg",
            x"0011",
            100,
            expires_at,
            1,
            vector::empty(),
            0,
            @0x0, vector::empty());
        publish_work(
            creator,
            b"work-2",
            b"photo-v2.jpg",
            x"0022",
            120,
            expires_at,
            2,
            b"work-1",
            0,
            @0x0, vector::empty());

        let (_, _, _, _, _, _, _, revision, parent, _, _, _, _) = get_work(b"work-2");
        assert!(revision == 2, 200);
        assert!(parent == b"work-1", 201);
    }

    #[test(aptos_framework = @0x1, publisher = @karya_registry, creator = @0xcafe)]
    #[expected_failure(abort_code = 13, location = Self)]
    fun duplicate_work_id_is_rejected(aptos_framework: &signer, publisher: &signer, creator: &signer) {
        setup_time(aptos_framework);
        initialize(publisher);
        let expires_at = timestamp::now_microseconds() + 1_000_000;
        publish_work(creator, b"same", b"one", x"01", 1, expires_at, 1, vector::empty(), 0, @0x0, vector::empty());
        publish_work(creator, b"same", b"two", x"02", 1, expires_at, 1, vector::empty(), 0, @0x0, vector::empty());
    }

    #[test(aptos_framework = @0x1, publisher = @karya_registry, creator = @0xcafe, buyer = @0xface)]
    fun premium_purchase_transfers_exact_asset_and_grants_entitlement(
        aptos_framework: &signer,
        publisher: &signer,
        creator: &signer,
        buyer: &signer,
    ) {
        setup_time(aptos_framework);
        initialize(publisher);
        let (creator_ref, metadata) = fungible_asset::create_test_token(creator);
        let (mint_ref, _, _) = primary_fungible_store::init_test_metadata_with_primary_store_enabled(&creator_ref);
        let buyer_address = signer::address_of(buyer);
        let creator_address = signer::address_of(creator);
        primary_fungible_store::mint(&mint_ref, buyer_address, 100);
        let currency_metadata = metadata.object_address();
        let expires_at = timestamp::now_microseconds() + 1_000_000;

        publish_work(
            creator,
            b"premium-1",
            b"premium.jpg",
            x"aabb",
            100,
            expires_at,
            1,
            vector::empty(),
            25,
            currency_metadata, b"wrapped-key");
        purchase(buyer, b"premium-1", currency_metadata);

        assert!(primary_fungible_store::balance(buyer_address, metadata) == 75, 300);
        assert!(primary_fungible_store::balance(creator_address, metadata) == 25, 301);
        assert!(has_entitlement(buyer_address, b"premium-1"), 302);
        let (exists, _, entitlement_expiry) = get_entitlement(buyer_address, b"premium-1");
        assert!(exists, 303);
        assert!(entitlement_expiry == expires_at, 304);
    }

    #[test(aptos_framework = @0x1, publisher = @karya_registry, creator = @0xcafe)]
    fun creator_can_disable_work_without_deleting_proof(aptos_framework: &signer, publisher: &signer, creator: &signer) {
        setup_time(aptos_framework);
        initialize(publisher);
        let expires_at = timestamp::now_microseconds() + 1_000_000;
        publish_work(creator, b"work-1", b"file", x"01", 1, expires_at, 1, vector::empty(), 0, @0x0, vector::empty());
        set_work_active(creator, b"work-1", false);
        let (_, _, _, _, _, _, _, _, _, _, _, _, active) = get_work(b"work-1");
        assert!(!active, 400);
        assert!(work_exists(b"work-1"), 401);
    }
}
