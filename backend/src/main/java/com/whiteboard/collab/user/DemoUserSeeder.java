package com.whiteboard.collab.user;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.seed.users.enabled", havingValue = "true")
public class DemoUserSeeder implements CommandLineRunner {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.users.count:100}")
    private int count;

    public DemoUserSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        long existing = userRepository.countByEmailContaining("@collabmail.io");
        if (existing >= count) {
            return;
        }

        String[] firstNames = {
                "Aarav", "Vivaan", "Aditya", "Arjun", "Reyansh", "Vihaan", "Krish", "Ishaan", "Kabir", "Rohan",
                "Ananya", "Aadhya", "Sara", "Meera", "Diya", "Saanvi", "Myra", "Riya", "Aisha", "Naina",
                "Rahul", "Karan", "Nikhil", "Siddharth", "Amit", "Varun", "Neha", "Priya", "Sneha", "Pooja",
                "Ritika", "Tanvi", "Harsh", "Yash", "Om", "Dev", "Aryan", "Akash", "Ravi", "Manav"
        };

        String[] lastNames = {
                "Sharma", "Verma", "Gupta", "Patel", "Singh", "Mehta", "Reddy", "Nair", "Iyer", "Chopra",
                "Joshi", "Malhotra", "Kapoor", "Bansal", "Agarwal", "Mishra", "Pandey", "Kulkarni", "Desai", "Bose",
                "Khanna", "Saxena", "Jain", "Sinha", "Chaudhary", "Tripathi", "Ghosh", "Dutta", "Tiwari", "Yadav"
        };

        int created = 0;
        int index = 0;
        while (created + existing < count) {
            String first = firstNames[index % firstNames.length];
            String last = lastNames[(index * 3) % lastNames.length];
            int n = index + 1;

            String email = (first + "." + last + n + "@collabmail.io").toLowerCase();
            if (userRepository.findByEmail(email).isPresent()) {
                index++;
                continue;
            }

            UserEntity user = new UserEntity();
            user.setName(first + " " + last);
            user.setEmail(email);
            user.setPasswordHash(passwordEncoder.encode("Password@123"));
            userRepository.save(user);

            created++;
            index++;
        }
    }
}
